var margin = {top: 30, right: 10, bottom: 10, left: 10},
    width = 960 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom;

var xScale = d3.scale.ordinal().rangePoints([0, width], 1),
    yScale = {};

var line = d3.svg.line(),
    axis = d3.svg.axis().orient("left"),
    background,
    foreground;

var svg = d3.select("body").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// Load Data
timePeriod = "Intertrial Interval";
d3.csv("DATA/" + timePeriod + " apc.csv", function(error, neurons) {

// Filter out sorting Variables
dimensions = d3.keys(neurons[0]).filter(function(d) {
      var sortingVariables = ["Neurons", "Session_Name", "Wire_Number", "Unit_Number", "Brain_Area", "Monkey", "Average_Firing_Rate"];
      return sortingVariables.indexOf(d) == -1;
    });

// Set xScale domain
xScale.domain(dimensions);

// Set yScale domain and range by looping over each data dimension and getting its max and min
dimensions.map(function(d) {
  yScale[d] = d3.scale.linear()
        .domain(d3.extent(neurons, function(p) { return +p[d]; }))
        .range([height, 0]);
  });

});
