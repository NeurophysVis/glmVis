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
  dimensions = d3.keys(neurons[0]).filter(function(dim) {
      var sortingVariables = ["Neurons", "Session_Name", "Wire_Number", "Unit_Number", "Brain_Area", "Monkey", "Average_Firing_Rate"];
      return sortingVariables.indexOf(dim) == -1;
    });

  // Set xScale domain
  xScale.domain(dimensions);

  // Set yScale domain and range by looping over each data dimension and getting its max and min
  yMin = d3.min(dimensions.map(function(dim) {
        return d3.min(neurons, function(neuron) { return +neuron[dim]; });
  }));

  yMax = d3.max(dimensions.map(function(dim) {
          return d3.max(neurons, function(neuron) { return +neuron[dim]; });
    }));

  // Set yScale for each dimension
  d3.keys(neurons[0]).filter(function(dim) {
    yScale[dim] = d3.scale.linear().domain([yMin, yMax]).range([height, 0]);
    return;
  });

   // Add grey background lines for context.
  background = svg.append("g")
      .attr("class", "background")
    .selectAll("path")
      .data(neurons)
    .enter().append("path")
      .attr("d", path);

  // Add blue foreground lines for focus.
  foreground = svg.append("g")
      .attr("class", "foreground")
    .selectAll("path")
      .data(neurons)
    .enter().append("path")
      .attr("d", path);

  // Add a group element for each dimension.
  var g = svg.selectAll(".dimension")
      .data(dimensions)
    .enter().append("g")
      .attr("class", "dimension")
      .attr("transform", function(d) { return "translate(" + xScale(d) + ")"; });

  // Add an axis and title.
  g.append("g")
      .attr("class", "axis")
      .each(function(d) { d3.select(this).call(axis.scale(yScale[d])); })
    .append("text")
      .style("text-anchor", "middle")
      .attr("y", -9)
      .text(function(dim) { return dim; });

  // Add and store a brush for each axis.
  g.append("g")
      .attr("class", "brush")
      .each(function(dim) {
          d3.select(this).call(yScale[dim].brush = d3.svg.brush().y(yScale[dim]).on("brush", brush));
        })
    .selectAll("rect")
      .attr("x", -8)
      .attr("width", 16);
});

// Returns the path for a given data point.
function path(data_point) {
  return line(dimensions.map(function(dim) { return [xScale(dim), yScale[dim](data_point[dim])]; }));
}

// Handles a brush event, toggling the display of foreground lines.
function brush() {
  var actives = dimensions.filter(function(dim) { return !yScale[dim].brush.empty(); }),
      extents = actives.map(function(dim) { return yScale[dim].brush.extent(); });
  foreground.style("display", function(neuron) {
    return actives.every(function(active_dim, extent_ind) {
      return (extents[extent_ind][0] <= neuron[active_dim]) && (neuron[active_dim] <= extents[extent_ind][1]);
    }) ? null : "none";
  });
}
