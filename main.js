//Got node library from - https://github.com/sindresorhus/got
const got = require('got');
const electron = require('electron');
const {ipcMain} = require('electron');
// Module to control application life.
const app = electron.app;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;

const Menu = electron.Menu;
const Tray = electron.Tray;

const parse = require('parse-link-header');

const path = require('path');
const url = require('url');

//Global
let mainWindow;
let flag;
let targetCommitURL;
let _tray;
let _window;

// App Variables
const App = {
    name: 'Quark',
    width: 705,
    height: 205,
    entry: path.join(__dirname, '/index.html')
};

//Initializes our frame in the toolbar
function createWindow () {

    if (app.dock) {
        app.dock.hide()
    }

    let platform = require('os').platform();

    // Determine appropriate icon for platform
    if (platform === 'darwin') {
        trayImage = path.join(__dirname, 'assets/quarkTemplate@3x.png');
    }
    else if (platform === 'win32') {
        trayImage = path.join(__dirname, 'assets/quark.ico');
    }

    //Initialize Tray
    _tray = new Tray(trayImage);
    _tray.setToolTip(App.name);
    //Matches default OSX toolbar behavior
    //Black icon default, white icon on selection
    if (platform === "darwin") {
        _tray.setPressedImage(path.join(__dirname, 'assets/quarkHighlight@2x.png'));
    }

    // Tray Events
    _tray.on('click', toggleWindow);
    _tray.on('double-click', toggleWindow);

    // Window
    _window = new BrowserWindow({
        width: App.width,
        height: App.height,
        show: false,
        frame: false,
        alwaysOnTop: true,
        resizable : false,
    });

    //Global shared object
    global.sharedObj = {
        hide: () => {
            _window.hide()
        },
        quit: app.quit,
        pinned: false
    };

    // Window Events
    _window.on('show', () => {
        _tray.setHighlightMode('always');
    });
    _window.on('hide', () => {
        _tray.setHighlightMode('never');
    });

    _window.on('blur', () => {
        if (!global.sharedObj.pinned) {
            _window.hide();
        }
    });

    // and load the index.html of the app.
    _window.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));


      // Open the DevTools for debugging if necessary
      //_window.webContents.openDevTools()

      // Emitted when the window is closed.
    _window.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
    })
}


function toggleWindow() {
    moveWindow();
    _window.isVisible() ? _window.hide() : _window.show();
}

//Makes sure the frameless window is placed appropriately near the toolbar
function moveWindow() {

    // Determine orientation.
    let orientation = 'top-right';
    let x = 0;
    let y = 0;

    const screen = (electron.screen.getDisplayNearestPoint(electron.screen.getCursorScreenPoint())).bounds;
    const trayBounds = _tray.getBounds();

    // Orientation is either not on top or OS is windows.
    if (process.platform === 'win32') {
        if (trayBounds.y > screen.height / 2) {
            orientation = (trayBounds.x > screen.width / 2) ? 'bottom-right' : 'bottom-left';
        } else {
            orientation = (trayBounds.x > screen.width / 2) ? 'top-right' : 'top-left';
        }
    } else if (process.platform === 'darwin') {
        orientation = 'top';
    }

    switch (orientation) {
        case 'top':
            x = Math.floor(trayBounds.x - App.width / 2 + trayBounds.width / 2);
            y = trayBounds.y + trayBounds.height;
            break;
        case 'top-right':
            x = screen.width - App.width;
            break;
        case 'bottom-left':
            y = screen.height - App.height;
            break;
        case 'bottom-right':
            y = screen.height - App.height;
            x = screen.width - App.width;
            break;
        case 'top-left':
        default:
            x = 0;
            y = 0;
    }

    // Normalize any out of bounds
    // maxX accounts for multi-screen setups where x is the coordinate across multiple screens.
    const maxX = screen.width + screen.x;
    x = (x > maxX ) ? maxX - App.width : (x < 0) ? 0 : x;
    y = (y > screen.height) ? screen.height - App.height : (y < 0) ? 0 : y;
    _window.setPosition(x, y);
}



// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
});

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
});


//Takes input from our render process and loads the necessary data through the Github API
ipcMain.on('repoInput', (event, userInput) => {

    let targetInfo = [null, null];
    //splits user input so it can be parsed
    userInput = userInput.split("/");
    targetInfo[0] = userInput[userInput.length - 2] + "/";
    targetInfo[1] = userInput[userInput.length - 1] + "/";


    targetCommitURL = 'https://api.github.com/repos/' + targetInfo[0] + targetInfo[1] + "commits";

    //TODO: Add variable time window for commit changes
    //Calculates the timestamp to filter commits by
    //190080000 is the milliseconds we want to go back, ~20 days right now
    let oneWeekAgo = new Date(Date.now() - 1900800000);
    oneWeekAgo = oneWeekAgo.toISOString();
    const targetRepoURL = targetCommitURL + "?since=" + oneWeekAgo + "?per_page=100";
    console.log(targetRepoURL);


    //Using the generated target URL, retrieves all commits in the specified repo after a specific date
    getCommitsByRepo(targetRepoURL, []);

    //Checks if the repo data is loaded
    let loadCheck = setInterval(loaded, 2000);
    flag = false;

    function loaded() {
        if(flag){
            console.log("Loaded!");
            console.log(graphDataTotal);
            console.log(graphDataChanges);
            clearInterval(loadCheck);
            //returns the commits, filtered and transformed appropriately, to the render process
            event.sender.send('heatmap-ready', {changes: graphDataChanges, total : graphDataTotal});
        }else{
            console.log("Not loaded :(");
        }
    }

});

//Gets all commits from the specified targetURL, takes into account pagination
//Passes commit sha values to a separate function for further processing
function getCommitsByRepo(target, data, exit = false) {
    got(target, {
        useElectronNet : false,
        headers: {
            'accept': 'application/vnd.github.v3+json',
            'user-agent': `MaxwellHeller`,
            "Authorization": process.env.API_KEY,
        }
    }).then(res => {
        //Gets the next link and the next, last page numbers
        //Handles pagination
        let response = parse(res.headers.link);

        res = JSON.parse(res.body);
        for (commit in res) {
            //console.log(res[commit].sha); - For debugging/testing
            data.push(res[commit].sha);
        }

        if(exit || response === null || response.last.page === '1'){
            console.log(data);
            getCommitsBySha(targetCommitURL, data, []);
        }else{

            const last = response.last.page;
            const next = response.next.page;
            console.log(last, next);

            //Accesses the next page, passes the current data array so it can continue to be appended to
            if (last === next) {
                getCommitsByRepo(response.last.url, data, true);
            }else{
                getCommitsByRepo(response.next.url, data, false);
            }
        }
    });
}

//Uses the commit SHA values to access the change information for each commit:
//Additions, Deletions, Total changes
//Once done, passes data to along for pre-processing
function getCommitsBySha(target, data, outputData) {

    sha = data.shift();

    if (sha === undefined){
        //console.log(outputData);
        preProcessData(outputData);
    }else {

        got(target + "/" + sha, {
            headers: {
                'accept': 'application/vnd.github.v3+json',
                'user-agent': `MaxwellHeller`,
                "Authorization": process.env.API_KEY,
            }
        }).then(res => {

            res = JSON.parse(res.body);
            outputData.push([res.commit.author.date, res.stats]);
            getCommitsBySha(target, data, outputData);
        });
    }
}

//Initializes a properly formatted graph JSON object
//Used to maintain correct Data formatting in our render process
let graphDataTotal = {
    labels : ["12p", "1a", "2a", "3a", "4a", "5a", "6a", "7a", "8a", "9a", "10a", "11a", "12a", "1p", "2p", "3p", "4p", "5p", "6p", "7p", "8p", "9p", "10p", "11p"],
    datasets : [
        {
            label: 'Mo',
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
            label: 'Tu',
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
            label: 'We',
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
            label: 'Th',
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
            label: 'Fr',
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
            label: 'Sa',
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
            label: 'Su',
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        }
    ]
};

//Same as above
let graphDataChanges = {
    labels : ["12p", "1a", "2a", "3a", "4a", "5a", "6a", "7a", "8a", "9a", "10a", "11a", "12a", "1p", "2p", "3p", "4p", "5p", "6p", "7p", "8p", "9p", "10p", "11p"],
    datasets : [
        {
            label: 'Mo',
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
            label: 'Tu',
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
            label: 'We',
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
            label: 'Th',
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
            label: 'Fr',
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
            label: 'Sa',
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
            label: 'Su',
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        }
    ]
};

//Fills our pre-formatted graph objects with information on each commit
//One graph for the total amount of changes and another for the net change (additions - deletions)
function preProcessData(data){
    for (commit in data) {

        commitDate = new Date(data[commit][0]);

        var changes = data[commit][1].additions - data[commit][1].deletions;
        if(data[commit][1].total > 100){
            data[commit][1].total = 100;
        }

        graphDataTotal.datasets[commitDate.getDay()].data[commitDate.getHours()] += data[commit][1].total;
        graphDataChanges.datasets[commitDate.getDay()].data[commitDate.getHours()] += changes;

    }

    flag = true;
}
