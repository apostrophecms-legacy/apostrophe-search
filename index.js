/* jshint node:true */
var _ = require('lodash');

module.exports = search;

function search(options, callback) {
  return new search.Search(options, callback);
}

search.Search = function(options, callback) {
  var apos = options.apos;
  var app = options.app;
  var self = this;
  self._apos = apos;
  self._app = app;
  self._action = '/apos-search';
  self._perPage = options.perPage || 10;
  self._options = options;

  // Mix in the ability to serve assets and templates
  self._apos.mixinModuleAssets(self, 'search', __dirname, options);

  // Use the setBridge call to do things we don't want to do
  // until other modules have been configured
  self.setBridge = function(modules) {
    // A simple way for modules to declare themselves unsearchable:
    // just listen for the "unsearchable" event and push page type names
    // onto the array it receives as its sole argument.

    self.unsearchable = [];
    apos.emit('unsearchable', self.unsearchable);
  };

  // A page loader function. If the page type is 'search',
  // it'll kick in and make search results available in req.extras.search.
  // You enable this by specifying it when you set your loader option in
  // calling pages.serve. Include a form on the page template with itself as
  // the action so you can make queries. (Confused? See the sandbox for
  // an example.)

  self.loader = function(req, callback) {

    if (!req.page) {
      // We're only interested in exact matches, /search/something is
      // none of our business, we don't look at req.bestPage
      return callback(null);
    }

    // We're only interested in enhancing pages of type "search"
    if (req.page.type !== 'search') {
      return callback(null);
    }

    var searchFilters = [
      { name: 'other', label: 'Pages' }
    ];

    apos.emit('addSearchFilters', searchFilters);

    // Option to override or shut off with false
    if (self._options.filters !== undefined) {
      searchFilters = _.cloneDeep(self._options.filters);
    }

    req.extras.searchFilters = searchFilters;

    var q = self._apos.sanitizeString(req.query.q);
    req.extras.q = q;

    var resultGroups = [];

    var filtersActive = [];
    var filtersInactive = [];


    req.extras.filterStatus = {};

    if (searchFilters) {
      _.each(searchFilters, function(filter) {
        var value = self._apos.sanitizeBoolean(req.query[filter.name], true);
        if (value) {
          filter.active = true;
          filtersActive.push(filter.name);
          req.extras.filterStatus[filter.name] = '';
        } else {
          filtersInactive.push(filter.name);
          req.extras.filterStatus[filter.name] = '0';
        }
      });
    }

    var criteria = {};

    var $in;
    var $nin;
    var typeCriteria = {};

    // If all filters are active, we don't have
    // to do anything, otherwise...
    if (filtersInactive.length) {
      if (!_.contains(filtersActive, 'other'))  {
        typeCriteria.$in = filtersActive;
      } else {
        typeCriteria.$nin = _.filter(filtersInactive, function(name) { return name !== 'other';
        });
      }
    }
    if (self.unsearchable.length) {
      typeCriteria.$nin = (typeCriteria.$nin || []).concat(self.unsearchable);
    }
    if (typeCriteria.$in || typeCriteria.$nin) {
      criteria.type = typeCriteria;
    }

    apos.emit('addSearchCriteria', req, criteria);

    var options = {};

    var sort;
    if ((!req.query.sort) || (req.query.sort === 'quality')) {
      sort = 'q';
    } else {
      // Chronological sort
      sort = { start: -1, publishedAt: -1, createdAt: -1 };
    }

    options.sort = sort;

    options.search = q;

    self.addPager(req, options);

    if (req.extras.pager.page > 100) {
      // Very large numbers of results can cause MongoDB to
      // issue sort errors and are not useful. -Tom
      req.notfound = true;
      return setImmediate(callback);
    }

    return self.get(req, criteria, options, function(err, results) {
      if (err) {
        console.error(err);
        req.statusCode = 500;
        return callback(null);
      }
      self.setPagerTotal(req, results.total);
      req.extras.search = results.pages;
      req.template = self.renderer('index');
      return callback(null);
    });
  };

  // For project level overrides
  self.get = function(req, criteria, options, callback) {
    return self._apos.get(req, criteria, options, callback);
  };

  // Sets up req.extras.pager and adds skip and limit to the criteria.
  // We also setPagerTotal after the total number of items available
  // is known (results.total in the get callback). Also sets an appropriate
  // limit if an RSS feed is to be generated.

  self.addPager = function(req, options) {
    var pageNumber = self._apos.sanitizeInteger(req.query.page, 1, 1);

    req.extras.pager = {
      page: pageNumber
    };

    options.skip = self._perPage * (pageNumber - 1);
    options.limit = self._perPage;
  };

  self.setPagerTotal = function(req, total) {
    if (req.extras.pager) {
      req.extras.pager.total = Math.ceil(total / self._perPage);
      if (req.extras.pager.total < 1) {
        req.extras.pager.total = 1;
      }
      // Very large numbers of text search results can cause
      // mongodb to generate sorting errors and are not useful. -Tom
      if (req.extras.pager.total > 100) {
        req.extras.pager.total = 100;
      }
    }
  };

  // Given a slug that was returned as a search result, generate a redirect
  // to the appropriate place. The idea is that doing this when users actually
  // click is much cheaper than determining the perfect URL for every search
  // result in the list, most of which will never be clicked on

  app.get(self._action + '/search-result', function(req, res) {
    var slug = req.query.slug;
    return apos.getPage(req, slug, function(err, page) {
      if (!page) {
        res.statusCode = 404;
        return res.send('Not Found');
      }
      if (page.slug.match(/\//)) {
        // TODO this is another place we are hardcoding the root, it is
        // increasingly clear we don't support more than one root right now
        return res.redirect(page.slug);
      } else {
        // we don't know what to do with this kind of page, but
        // another module might; emit an event
        var context = {};
        apos.emit('searchResult', req, res, page, context);
        if (!context.accepted) {
          // No one will admit to knowing what to do with this page
          res.statusCode = 404;
          return res.send('Not Found');
        } else {
          // Someone else is asynchronously dealing with it, we're good here
        }
      }
    });
  });
  if (callback) {
    return process.nextTick(callback);
  }
};

