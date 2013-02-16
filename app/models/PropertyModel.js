var nodeio = require('node.io')

module.exports = function (app, config) {

  return app.getModel("Application", true).extend(function() {

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

      return properties.filter(function(p) {
        if (p) return true;
      })
    }
  })
  .methods({

    // returns all the properties for a given id
    properties: function (location, pageCount, callback) {

      var that = this
      var client = that.dbClient()

      client.hget(location, 'properties', function(err, reply) {

        // quit on error
        if (err) {
          client.quit()
          return callback(false)
        }

        if (reply) {
          client.quit()
          return callback(JSON.parse(reply))
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

              this.emit(that.scrapeListings(properties))
            })
          }
        })

        nodeio.start(job, { id: location, offset: 0, type: 'Restaurant' }, function(err, output) {
          if (err) {
            callback(false)
            return
          }

          client.hset(location, 'properties', JSON.stringify(output), app.db.print)
          client.quit()

          callback(output)
        }, true)
      })
    },

    // returns the review count for a property
    reviewCount: function(property, callback) {

      var client = this.dbClient()

      client.hget(property.id, 'review_count', function(err, reply) {

        // error
        if (err) {
          client.quit()
          return callback(false)
        }

        // return count if already stored
        if (reply) {
          client.quit()
          return callback(JSON.parse(reply))
        }

        var job = new nodeio.Job(this.nodeOptions, {
          input: false,
          run: function () {
            this.getHtml('http://www.tripadvisor.co.uk/Restaurant_Review-g186299-d' + this.options.property.id + '-Reviews-or0.html', function (err, $) {

              // retry
              if (err) {
                return this.retry()
              }

              // extract the review count
              var reviewCount = $('.pgCount').text

              if (!reviewCount) return this.retry()

              // calculate the page count & return the property
              this.emit(Math.ceil(reviewCount / 10))
            })
          }
        })

        nodeio.start(job, { property: property }, function(err, output) {
          if (err) {
            return callback(false)
          }

          client.hset(property.id, 'review_count', output, app.db.print)
          client.quit()
          return callback(output)

        }, true)
      })
    },

    // returns all the ratings for a set of properties
    reviews: function(property, callback) {

      var client = this.dbClient()

      client.hget(property.id, 'reviews', function(err, reply) {

        if (err) {
          console.log(property.id)
          client.quit()
          return callback(false)
        }

        if (reply) {
          client.quit()
          return callback(JSON.parse(reply))
        }

        var offsets = []
        for (var i = 0; i < property.reviewCount; i++) {
          offsets.push(i * 10)
        }

        var job = new nodeio.Job(this.nodeOptions, {
          input: offsets,
          run: function (offset) {
            this.getHtml('http://www.tripadvisor.co.uk/Restaurant_Review-g186299-d' + this.options.property.id + '-Reviews-or' + offset + '.html', function (err, $) {

              if (err) {
                this.fail()
                return
              }

              // extract the review from the page
              var reviews = $('#REVIEWS .review')

              if (typeof reviews[0] === 'undefined') {
                this.fail()
                return
              }

              // return the review date, rating and users review count
              this.emit(reviews.map(function(r) {
                var reviewCount = 0

                if (typeof r.children[0].children[1] == 'undefined') {
                  return { empty: true }
                }

                if (typeof r.children[0].children[1].children[0].children[1] !== 'undefined') {
                  reviewCount = r.children[0].children[1].children[0].children[1].attribs.alt.replace(/ (reviews|review)/, '')
                } else {
                  reviewCount = r.children[0].children[1].children[0].children[0].children[0].data.replace(/ (reviews|review)/, '')
                }

                return {
                  date: Date.parse(r.children[1].children[1].children[1].children[0].data.replace(/Reviewed /, '')),
                  rating: r.children[1].children[1].children[0].children[0].attribs.content,
                  review_count: reviewCount
                }
              }))
            })
          }
        });

        // start the job, returns control to the callback when all
        // properties have been processed
        nodeio.start(job, { property: property }, function(err, output) {
            client.hset(property.id, 'reviews', JSON.stringify(output), app.db.print)
            client.quit()
            return callback(output)
        }, true)
      })
    }
  })
}
