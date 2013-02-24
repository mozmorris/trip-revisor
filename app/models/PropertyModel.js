module.exports = function (app, config) {

  var nodeio = require('node.io')
  var async = require('async')

  return app.getModel("Application", true).extend(function() {

    // db schema
    this.DBModel = this.mongoose.model('Property', new this.Schema({
        name: { type: String, required: true, trim: true }
      , trip_id: { type: Number, required: true }
      , location_id: { type: Number, required: true }
      , href: { type: String, required: true }
      , review_count: { type: Number }
    }))

    // scrapes the properties from the node tree
    this.scrapeListings = function(properties) {

      // return an array of the property data
      var properties = properties.map(function(p) {

        // drop anything with a property id
        if (!p.attribs.id) {
          return false
        }

        // extract the property id
        var property = {
          id: p.attribs.id.replace(/\w+_/, '')
        }

        // handle the different markup patterns - the markup
        // varies to due promotions or facebook related crap
        if (p.children.length === 3) {
          if (p.children[1].children.length >= 3) {
            property.title = p.children[1].children[2].children[0].data
            property.href = p.children[1].children[2].attribs.href
          } else {
            property.title = p.children[1].children[1].children[0].data
            property.href = p.children[1].children[1].attribs.href
          }
        } else {
          property.title = p.children[0].children[1].children[0].data
          property.href = p.children[0].children[1].attribs.href
        }

        return property
      })

      // ditch any blanks
      return properties.filter(function(p) {
        if (p) return true;
      })
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
    // returns all the properties for a given location id
    properties: function (location, pageCount, callback) {

      var that = this
      var db = this.DBModel

      db.find({ location_id: location }, v.bind(this, function(err, properties) {

        if (properties.length) {
          return callback(false, properties)
        }

        // create an array of page offsets based on the number
        // of pages - TripAdvisor displays 30 properties per page
        var offsets = []
        for (var i = 0; i < pageCount; i++) {
          offsets.push(i * 30)
        }

        // find a location's restaurants/hotels/attractions
        var job = new nodeio.Job(this.nodeOptions, {
          input: offsets,
          run: function (offset) {
            this.getHtml('http://www.tripadvisor.co.uk/' + this.options.type + 'Search?ajax=1&geo=' + this.options.id + '&o=a' + offset, function (err, $) {

              // retry
              if (err) {
                return this.retry()
              }

              // get all property nodes from the markup
              var properties = $('.listing')

              // check the returned result in an object
              if (Object.prototype.toString.call(properties) !== '[object Array]' ) {
                return this.fail()
              }

              // extract the property id, title and href
              this.emit(that.scrapeListings(properties))
            })
          }
        })

        // nodeio job
        nodeio.start(job, { id: location, offset: 0, type: 'Restaurant' }, function(err, output) {
          if (err) {
            return callback(false)
          }

          // save the properties in parallel
          var functions = [];
          for (var i=0; i < output.length; i++) {
            functions.push((function(o) {
              return function(callback) {
                var property = new db({
                  name: o.title,
                  trip_id: o.id,
                  href: o.href,
                  location_id: location
                })
                property.save(callback)
              };
            })(output[i]));
          }

          async.parallel(functions, function(err, results) {
            callback(results);
          });

        }, true)
      }))
    },

    // returns the review count for a property
    reviewCount: function(propertyId, callback) {

      var db = this.DBModel

      db.findOne({ trip_id: propertyId }, v.bind(this, function(err, result) {

        if (!result) {
          // no property
          return callback(true)
        }

        if (result && result.review_count) {
          return callback(false, result.review_count)
        }

        var job = new nodeio.Job(this.nodeOptions, {
          input: false,
          run: function () {
            this.getHtml('http://www.tripadvisor.co.uk/Restaurant_Review-g186299-d' + this.options.propertyId + '-Reviews-or0.html', function (err, $) {

              // retry on error
              if (err) {
                return this.retry()
              }

              // extract the review count
              var reviewCount = $('.pgCount').text

              if (!reviewCount) return this.retry()

              // calculate the page count
              this.emit(Math.ceil(reviewCount / 10))
            })
          }
        })

        // nodeio job
        nodeio.start(job, { propertyId: propertyId }, function(err, output) {
          if (err) {
            return callback(true)
          }

          db.update({ trip_id: propertyId}, {
            review_count: output[0]
          }, function(err, row, raw) {
            return callback(false, output[0])
          })
        }, true)
      }))
    }
  })
}
