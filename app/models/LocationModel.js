var nodeio = require('node.io')

module.exports = function (app, config) {

  return app.getModel("Application", true).extend(function() {

    this.DBModel = this.mongoose.model('Location', new this.Schema({
        name: { type: String, required: true, trim: true }
      , trip_id: { type: String, required: true, trim: true }
      , properties_count: { type: Number }
    }))

    // extract the properties count
    this.getCount = function($) {
      // potentially flaky, but then what did you expect?
      var pageCount = $('.pgCount').last().text

      // calculate and return the page count
      return Math.ceil(pageCount / 30)
    }
  })
  .methods({

    // return a location by name
    findByName: function(name, callback) {
      this.DBModel.findOne({ name: name }, callback)
    },

    // add a new location
    create: function(name, trip_id, callback) {
      var location = new this.DBModel({
        name: name.toLowerCase(),
        trip_id: trip_id
      })
      location.save(callback)
    },

    // find the number of properties
    pageCount: function(trip_id, callback) {
      var that = this
      var db = this.DBModel

      db.findOne({ trip_id: trip_id }, v.bind(this, function(err, location) {

        if (location && location.properties_count) {
          return callback(err, location.properties_count)
        }

        // node.io job to extract the properties count
        var job = new nodeio.Job(this.nodeOptions, {
          input: false,
          run: function() {
            this.getHtml('http://www.tripadvisor.co.uk/' + this.options.type + 'Search?ajax=1&geo=' + this.options.trip_id + '&o=a0', function (err, $) {

              // quit on error
              if (err) {
                return this.retry()
              }

              // extract the count
              this.emit(that.getCount($))
            })
          }
        })

        // start the job & store the results
        nodeio.start(job, { trip_id: trip_id, type: 'Restaurant' }, function(err, output) {
          if (err) {
            return callback(false)
          }

          // store, quit client and fire the callback
          var location = new db({
            name: 'Test',
            trip_id: trip_id,
            properties_count: parseInt(output, 10)
          })
          location.save(callback)

        }, true)

      }))
    }
  })

}
