# Mixer Frontend

The frontend is a React 16 app written in TypeScript. It uses Parcel to handle
source bundling.

## Development

For a hot-reloading development setup, run the following command in this
directory:

```bash
npm run watch
```

And launch [http://localhost:1234](http://localhost:1234) in your browser.

## Production

To create a production build, run:

```bash
npm run build
```

## Stylesheets

All stylesheets are written in LESS and stored in `less/`.

`index.html` imports `index.less`. In turn, `index.less` imports all other
stylesheets named `index.less` in various subfolders.

We use convention to separate of style concerns.

- `constants.less`: defines colour values, lengths, font sizes, and any
  absolute values used by the other stylesheets.

- `routes/index.less`: defines styles common to all routes, and also imports
  all stylesheets in `routes/`.

- `routes/<name>.less`: defines styles specific to `routes/<name>.tsx`

- `components/index.less`: defines styles common to all components, and also imports
  all stylesheets in `components/`.

- `components/<name>.less`: defines styles specific to `components/<name>.tsx`

The layout should be responsive. Media queries should go into each individual
stylesheet. e.g. `constants.less` should contain a media query which sets
different margins for different screen sizes, `deposit.less` should handle its
own responsive styles, etc.
