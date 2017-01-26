# yourPlayer-mux

The yourPlayer plugin for Mux Analytics

## Using

Install dependencies:

`npm install`

Modify `src/index.js`, `scripts/deploy.js`, `ads.html`, and `index.html` to remove any references to `yourPlayer`.
The majority of your code will be in `src/index.js`

Once the code has been completed, run the following to build the package

`npm run build`

Then, run `npm run start` to start a webserver, and test the player at

* http://localhost:8080/index.html
* http://localhost:8080/ads.html
