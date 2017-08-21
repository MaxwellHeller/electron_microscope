const {ipcRenderer} = require("electron");
const chartLib = require('chart.heatmap.js');
Chart.defaults.global.animation['duration'] = 2000;


let ctx = document.getElementById('heatmap').getContext('2d');

//TODO: Add text input to our window so the user can specify the repo that is visualized
//Specifies the repo that is used
let userInput = "https://github.com/graphcool/chromeless";
let graphData;
let curGraph;

//Connects to menu elements in our interface
let menu_change = document.getElementById('change');
let menu_total = document.getElementById('total');

//Creates our chart, hides it until it is properly loaded, and sets padding so that
//our legends are properly displayed
chart = document.getElementById("heatmap");
chart.style.display = 'none';
chart.style.paddingLeft = '5px';

//Hides our dropdown menu
menu = document.getElementById('drop-menu');
menu.style.display = 'none';

//Sends the user selected repo to the main process so we can retrieve the commit history
//TODO: Pass in date information also, so user a selected date window can be used
ipcRenderer.send('repoInput', userInput);

//Receives the processed commit history from our main process
//Hides our loading animations and shows our now populated heatmap
ipcRenderer.on('heatmap-ready', (event, graphs) => {
    document.getElementById('spinner').style.display = 'none';
    document.getElementById("heatmap").style.display = 'block';
    graphData = graphs;
    curGraph = graphData.total;
    //Creates a D3.js heatmap
    //Heatmap library from http://tmroyal.github.io/Chart.HeatMap/
    let heatmap = new Chart(ctx).HeatMap(curGraph, {scaleFontFamily : "Roboto", scaleFontColor : '#dce0e8',
        showLabels: false, roundedRadius : 0.2, paddingScale : 0.1,
        colors : ["#ffffd9","#edf8b1","#c7e9b4","#7fcdbb","#41b6c4","#1d91c0","#225ea8","#253494","#081d58"]});
    menu_total.selected = true;
    menu_change.selected = false;
    menu.style.display = 'inline';

    //Arrow function to add an event listener to our right-click drop down menu
    //Destroys the current heatmap and reloads a heatmap based on the net changes
    (map => {

        menu_change.addEventListener('click', () => {
        if (menu_change.selected === false) {
            menu_change.selected = true;
            menu_total.selected = false;

            map.destroy();

            let ctx = document.getElementById('heatmap').getContext('2d');
            let heatmap = new Chart(ctx).HeatMap(graphData.changes, {scaleFontFamily : "Roboto", scaleFontColor : '#dce0e8',
                showLabels: false, roundedRadius : 0.2, paddingScale : 0.1,
                colors : ["#ffffd9","#edf8b1","#c7e9b4","#7fcdbb","#41b6c4","#1d91c0","#225ea8","#253494","#081d58"]});

        }

    })
    })(heatmap);

    //Arrow function to add an event listener to our right-click drop down menu
    //Destroys the current heatmap and reloads a heatmap based on the net changes
    (map => {

        menu_total.addEventListener('click', () => {

         if (menu_total.selected === false) {
            menu_change.selected = false;
            menu_total.selected = true;

            map.destroy();

            let ctx = document.getElementById('heatmap').getContext('2d');
            let heatmap = new Chart(ctx).HeatMap(graphData.total, {scaleFontFamily : "Roboto", scaleFontColor : '#dce0e8',
                 showLabels: false, roundedRadius : 0.2, paddingScale : 0.1,
                 colors : ["#ffffd9","#edf8b1","#c7e9b4","#7fcdbb","#41b6c4","#1d91c0","#225ea8","#253494","#081d58"]});
            }
        })
    })(heatmap);

});

