module.exports = function (app, config) {

  // define location of view folder
  var viewFolder = 'location'

  // gets the property page count for a location
  var getPropertyPageCount = function(location, callback) {
    app.getModel("Location").pageCount(location, callback)
  }

  // gets the properties for a location
  var getProperties = function(location, callback) {
    getPropertyPageCount(location, function(pageCount) {
      app.getModel("Property").properties(location, pageCount, callback)
    })
  }

  // gets the review count for a property
  var getReviewCount = function(property, callback) {
    app.getModel("Property").reviewCount(property, callback)
  }

  // gets the reviews for a property
  var getReviews = function(property, callback) {
    app.getModel("Property").reviews(property, callback)
  }

  return app.getController("Application", true).extend()
  .methods({
    index: function (req, res) {

    },
    properties: function(req, res, id) {
      var that = this
      var data = {title: 'properties'}
      var query = require('url').parse(req.path, true).query
      if (query.fragment) data.layout = false

      getProperties(req.params['id'], function(properties) {
        data.properties = properties
        that.render(res, viewFolder + '/properties', data)
      })
    }
  })
}
