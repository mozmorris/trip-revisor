var nodeio = require('node.io')

module.exports = function (app, config) {

  return app.getModel("Application", true).extend(function() {
    // vars
    this.nodeOptions = {
      timeout: 5,
      max: 50,
      retries: 3
    }

    // extract the properties count
    this.getCount = function($) {

      // potentially flaky, but then what did you expect?
      var pageCount = $('.pgCount').last().text

      // calculate and return the page count
      return Math.ceil(pageCount / 30)
    }
  })
  .methods({
    // find the number of properties
    pageCount: function(location, callback) {
      var that = this;

      // get a redis client
      var client = this.dbClient()

      client.hget(location, 'properties_count', function(err, reply) {

        // return result
        if (reply) {
          client.quit()
          return callback(JSON.parse(reply))
        }

        // node.io job to extract the properties count
        var job = new nodeio.Job(this.nodeOptions, {
          input: false,
          run: function() {
            this.getHtml('http://www.tripadvisor.co.uk/' + this.options.type + 'Search?ajax=1&geo=' + this.options.geoid + '&o=a0', function (err, $) {

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
        nodeio.start(job, { geoid: location, type: 'Restaurant' }, function(err, output) {
          if (err) {
            client.quit()
            return callback(false)
          }

          // store, quite client and fire the callback
          client.hset(location, 'properties_count', JSON.stringify(output), app.db.print)
          client.quit()
          return callback(output)

        }, true)
      })
    }
  })

}
