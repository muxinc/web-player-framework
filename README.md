# yourPlayer-mux

The yourPlayer plugin for Mux Analytics

## Using

Install dependencies:

`npm install`

Modify `src/index.js`, `scripts/deploy.js`, the webpack config files, `package.json`, `ads.html`, and `index.html` to remove any references to `yourPlayer`.
The majority of your code will be in `src/index.js`

Once the code has been completed, run the following to build the package

`yarn run package`

Then, run `yarn run start` to start a webserver, and test the player at

* http://localhost:8080/index.html
* http://localhost:8080/ads.html
