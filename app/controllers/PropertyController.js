module.exports = function (app, config) {

  // define location of view folder
  var viewFolder = 'property'

  // gets the review count for a property
  var getReviewCount = function(property, callback) {
    app.getModel("Property").reviewCount(property, callback)
  }

  // gets the reviews for a property
  var getReviews = function(property_id, callback) {
    getReviewCount(property_id, function(err, count) {
      app.getModel("Review").reviews(property_id, count, callback)
    })
  }

  return app.getController("Application", true).extend()
  .methods({
    view: function (req, res) {
      // meta
      var data = {title: 'properties'}
      var query = require('url').parse(req.path, true).query
      if (query.fragment) data.layout = false

      // get the reviews
      getReviews(req.params['id'], v.bind(this, function(err, property) {
        data.property = property
        this.render(res, viewFolder + '/view', data)
      }))
    }
  })
}
