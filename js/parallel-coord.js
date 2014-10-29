var margin = {top: 30, right: 10, bottom: 10, left: 150},
width = 500 - margin.left - margin.right,
height = 500 - margin.top - margin.bottom;

var yScale = d3.scale.ordinal().rangePoints([height, 0], 1),
xScale = {};

var data = {};

var line = d3.svg.line(),
axis = d3.svg.axis().orient("left"),
background,
foreground;

// Load Data
timePeriod = "Stimulus Response";
d3.csv("DATA/" + timePeriod + " apc.csv", function(error, data) {

  // Filter out sorting Variables
  dimensions = d3.keys(data[0]).filter(function(dim) {
    var sortingVariables = ["Neurons", "Session_Name", "Wire_Number", "Unit_Number", "Brain_Area", "Monkey", "Average_Firing_Rate"];
    return sortingVariables.indexOf(dim) == -1;
  });

  // Reverse dimension order for better understandability.
  dimensions = dimensions.reverse();

  // Set yScale domain
  yScale.domain(dimensions);

  // Set xScale domain and range by looping over each data dimension and getting its max and min
  xMin = d3.min(dimensions.map(function(dim) {
    return d3.min(data, function(neuron) { return +neuron[dim]; });
  }));

  xMax = d3.max(dimensions.map(function(dim) {
    return d3.max(data, function(neuron) { return +neuron[dim]; });
  }));

  neurons = d3.nest()
    .key(function(d) { return d["Brain_Area"]; })
    .entries(data);

  // Set xScale for each dimension and brain area
  xScale = neurons.map(function(dat) {
    return dimensions.map(function(dim) {
      return d3.scale.linear().domain([xMin, xMax]).range([0, width]);
    });
  });

  drawParallel()

});

// Draws parallel line plot
function drawParallel() {
  div = d3.select("#vis").selectAll(".chart").data(neurons);

  div.enter().append("div")
    .attr("class", "chart")
    .attr("id", function(d) {return d.key;})
    .append("svg");

  svg = div.select("svg")
      .attr("width", width + margin.left + margin.right )
      .attr("height", height + margin.top + margin.bottom )
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Add grey background lines for context.
  background = svg.append("g")
  .attr("class", "background")
  .selectAll("path")
  .data(function(d) {return d.values;})
  .enter().append("path")
  .attr("d", path);

  // Add blue foreground lines for focus.
  foreground = svg.append("g")
  .attr("class", "foreground")
  .selectAll("path")
  .data(function(d) {return d.values;})
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
  .attr("class", "grid")
      .each(function(dim, dim_ind, div_ind) {
          d3.select(this).call(makeXAxis(dim, dim_ind, div_ind));
        })
    .append("text")
      .style("text-anchor", "end")
      .attr("x", -5)
      .attr("y", 4)
      .text(function(dim) { return fixDimNames(dim); });

  // Add and store a brush for each axis.
  g.append("g")
  .attr("class", "brush")
  .each(function(dim, dim_ind, div_ind) {
    d3.select(this).call(makeXBrush(dim, dim_ind, div_ind));
  })
  .selectAll("rect")
  .attr("y", -8)
  .attr("height", 16);

}

// Returns the path for a given data point.
function path(data_point, ind, div_ind) {
  return line(dimensions.map(function(dim, dim_ind) {
    return [xScale[div_ind][dim_ind](data_point[dim]), yScale(dim)];
  }));
}

// Handles a brush event, toggling the display of foreground lines.
function brush() {
  var actives = dimensions.filter(function(dim, dim_ind) {
    return !xScale[0][dim_ind].brush.empty() || !xScale[1][dim_ind].brush.empty();
    }),
  extents = neurons.map(function(neuron, div_ind) {
    return actives.map(function(dim) {
      var dim_ind = dimensions.indexOf(dim);
      return xScale[div_ind][dim_ind].brush.extent();
      })
    });
  foreground.style("display", function(neuron) {
    return actives.every(function(active_dim, extent_ind) {
      return ((extents[0][extent_ind][0] <= neuron[active_dim])
        && (neuron[active_dim] <= extents[0][extent_ind][1]))
         ||
        ((extents[1][extent_ind][0] <= neuron[active_dim])
          && (neuron[active_dim] <= extents[1][extent_ind][1])
      );
    }) ? null : "none";
  });
}
// Creates the x-axis for a given dimension
function makeXAxis(dim, dim_ind, div_ind) {
  var newAxis = axis
  .scale(xScale[div_ind][dim_ind])
  .orient("top")
  .tickSize(0, 0, 0);

  if (dim.indexOf("Rule") == -1) {
    newAxis
    .ticks(0);
  } else {
    newAxis
    .ticks(5)
  }

  return newAxis;
}
// Creates a brush object for a given dimension
function makeXBrush(dim, dim_ind, div_ind) {
  xScale[div_ind][dim_ind].brush = d3.svg.brush().x(xScale[div_ind][dim_ind]).on("brush", brush);
  return xScale[div_ind][dim_ind].brush;
}
// Replaces underscores with blanks and "plus" with "+"
function fixDimNames(dim_name) {
  var pat1 = /plus/,
      pat2 = /_/g,
      pat3 = /minus/;

  var fixed_name = dim_name.replace(pat1, "+").replace(pat2, " ").replace(pat3, "-");

  return fixed_name;
}
