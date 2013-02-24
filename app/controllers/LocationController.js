module.exports = function (app, config) {

  // define location of view folder
  var viewFolder = 'location'

  // gets the property page count for a location
  var getPropertyPageCount = function(location, callback) {
    app.getModel("Location").pageCount(location, callback)
  }

  // gets the properties for a location
  var getProperties = function(location, callback) {
    getPropertyPageCount(location, function(err, pageCount) {
      app.getModel("Property").properties(location, pageCount, callback)
    })
  }

  return app.getController("Application", true).extend()
  .methods({
    create: function(req, res) {
      app.getModel("Location").create('Southampton', 186299, v.bind(this, function(err, location) {
        this.render(res, viewFolder + '/view', location)
      }))
    },
    view: function(req, res) {
      // meta
      var data = {title: 'property'}

      app.getModel("Location").findByName('southampton', v.bind(this, function(err, location) {
        this.render(res, viewFolder + '/view', location)
      }))
    },
    properties: function(req, res) {
      // meta
      var data = {title: 'properties'}

      // get the list of properties for the current location
      getProperties(req.params['id'], v.bind(this, function(err, properties) {
        data.properties = properties
        this.render(res, viewFolder + '/properties', data)
      }))
    }
  })
}
