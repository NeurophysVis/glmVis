var margin = {top: 30, right: 10, bottom: 10, left: 105},
    width = 700 - margin.left - margin.right,
    height = 700 - margin.top - margin.bottom;

var yScale = d3.scale.ordinal().rangePoints([height, 0], 1),
    xScale = {};

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

  // Reverse dimension order for better understandability.
  dimensions = dimensions.reverse();

  // Set yScale domain
  yScale.domain(dimensions);

  // Set xScale domain and range by looping over each data dimension and getting its max and min
  xMin = d3.min(dimensions.map(function(dim) {
        return d3.min(neurons, function(neuron) { return +neuron[dim]; });
  }));

  xMax = d3.max(dimensions.map(function(dim) {
          return d3.max(neurons, function(neuron) { return +neuron[dim]; });
    }));

  // Set xScale for each dimension
  dimensions.filter(function(dim) {
    xScale[dim] = d3.scale.linear().domain([xMin, xMax]).range([0, width]);
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
      .attr("transform", function(d) { return "translate(0," + yScale(d) + ")"; });

  // Add an axis and title.
  g.append("g")
      .attr("class", "axis")
      .each(function(dim) { d3.select(this).call(makeXAxis(dim)); })
    .append("text")
      .style("text-anchor", "middle")
      .attr("x", -55)
      .text(function(dim) { return fixDimNames(dim); });

  // Add and store a brush for each axis.
  g.append("g")
      .attr("class", "brush")
      .each(function(dim) {
          d3.select(this).call(makeXBrush(dim));
        })
    .selectAll("rect")
      .attr("y", -8)
      .attr("height", 16);
});

// Returns the path for a given data point.
function path(data_point) {
  return line(dimensions.map(function(dim) { return [xScale[dim](data_point[dim]), yScale(dim)]; }));
}

// Handles a brush event, toggling the display of foreground lines.
function brush() {
  var actives = dimensions.filter(function(dim) { return !xScale[dim].brush.empty(); }),
      extents = actives.map(function(dim) { return xScale[dim].brush.extent(); });
  foreground.style("display", function(neuron) {
    return actives.every(function(active_dim, extent_ind) {
      return (extents[extent_ind][0] <= neuron[active_dim]) && (neuron[active_dim] <= extents[extent_ind][1]);
    }) ? null : "none";
  });
}

function makeXAxis(dim) {
  var newAxis = axis
        .scale(xScale[dim])
        .orient("top");

  if (dim.indexOf("Rule") > -1) {
      newAxis
          .ticks(5);
  } else {
      newAxis
          .ticks(0)
          .tickSize(0);
  }

  return newAxis;
}

function makeXBrush(dim) {
  xScale[dim].brush = d3.svg.brush().x(xScale[dim]).on("brush", brush);
  return xScale[dim].brush;
}

function fixDimNames(dim_name) {
  var pat1 = /plus/;
  var fixed_name = dim_name.replace(pat1, "+");
  var pat2 = /_/;
  return fixed_name.replace(pat2, " ");
}
