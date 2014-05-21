# apostrophe-search

This module adds a user interface for sitewide search to A2 sites.

## Installation

```bash
npm install apostrophe-search
```

## Activating the Module

In `app.js`, in your `modules` section:

```javascript
    apostrophe-search: {}
```

## Adding the mini-form to your layout

Just use a cross-module include:

```markup
{% include "search:miniForm.html" %}
```

## Adding the search results page to your site

It's already there. Currently the `apostrophe:reset` task creates one and gives it the slug `/search`.

## Customizing the search results page

Create `lib/modules/apostrophe-search/views` and copy `index.html` from this module's `views` folder to that folder. Then edit as you see fit. Your override will automatically be recognized. It works just like overriding the blog module, snippets module, et cetera.

## Customizing the mini-form

Copy `miniForm.html` in the same way. Or just write your own form directly in your layout. You must use the GET method and the user's search text must be in the `q` query parameter. The action of your form should be `/search`.

## Customizing the Search Filters

By default filters are displayed which can be used to filter out various results such as blog posts, events, etc. until the user is left with the results they wanted.

By default the list is very complete. The search module emits an `addSearchFilters` event on the `apos` object, passing an array as the first argument, and modules that are interested in having a search filter simply
push page type names onto that array.

If you wish to restrict the list of filters on your site you can pass a `searchFilters` option when configuring the module in `app.js`. Here the only filters provided are for blog posts and "pages."

Note that the filter with the name "other" actually matches everything not matched by your other filters. We label this filter "pages" because it is less confusing for the user.

```javascript
    apostrophe-search: {
      filters: [
        {
          name: 'other',
          label: 'Pages'
        },
        {
          name: 'blogPost',
          label: 'Articles'
        }
      ]
    }
```

You can also shut off filters entirely for a project:

```javascript
    apostrophe-search: {
      filters: false
    }
```

You should use `false`, not an empty array.

## Styles

Sample styles are available in the [sandbox project](https://github.com/punkave/apostrophe-search) in `public/css/search.less`.
