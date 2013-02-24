module.exports = function (app, config) {

  var async = require('async')
  var nodeio = require('node.io')

  return app.getModel("Application", true).extend(function() {
    // db schema
    this.DBModel = this.mongoose.model('Review', new this.Schema({
        date: { type: Date, required: true, trim: true }
      , rating: { type: Number, required: true, trim: true }
      , user_review_count: { type: Number, required: true, trim: true }
      , property_id: { type: Number, required: true, trim: true }
    }))
  })
  .methods({
    // returns all the ratings for a set of properties
    reviews: function(propertyId, count, callback) {
      var db = this.DBModel

      db.find({ property_id: propertyId }, v.bind(this, function(err, result) {

        if (result.length) {
          return callback(false, result)
        }

        var offsets = []
        for (var i = 0; i < count; i++) {
          offsets.push(i * 10)
        }

        var job = new nodeio.Job(this.nodeOptions, {
          input: offsets,
          run: function (offset) {
            this.getHtml('http://www.tripadvisor.co.uk/Restaurant_Review-g186299-d' + this.options.propertyId + '-Reviews-or' + offset + '.html', function (err, $) {

              if (err) {
                return this.fail()
              }

              // extract the review from the page
              var reviews = $('#REVIEWS .review')

              if (typeof reviews[0] === 'undefined') {
                return this.fail()
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
                  user_review_count: reviewCount
                }
              }))
            })
          }
        })

        // start the job, returns control to the callback when all
        // properties have been processed
        nodeio.start(job, { propertyId: propertyId }, function(err, output) {

          // save the properties in parallel
          var functions = [];
          for (var i=0; i < output.length; i++) {
            functions.push((function(o) {
              return function(cb) {
                var review = new db({
                  date: o.date,
                  rating: o.rating,
                  user_review_count: o.user_review_count,
                  property_id: propertyId
                })
                review.save(cb)
              }
            })(output[i]))
          }

          async.parallel(functions, function(err, results) {
            return callback(false, output)
          })

        }, true)
      }))
    }
  })
}
