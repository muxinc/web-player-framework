// import window from 'global/window'; // Remove if you do not need to access the global `window`
import document from 'global/document'; // Remove if you do not need to access the global `document`
import mux from 'mux-embed';

const log = mux.log;
const secondsToMs = mux.utils.secondsToMs;
const assign = mux.utils.assign;
// const getComputedStyle = mux.utils.getComputedStyle; // If necessary to get

// Helper function to generate "unique" IDs for the player if your player does not have one built in
const generateShortId = function () {
  return ('000000' + (Math.random() * Math.pow(36, 6) << 0).toString(36)).slice(-6);
};

const initShakaPlayerMux = function (player, options) {
  // Make sure we got a player - Check properties to ensure that a player was passed
  if (typeof player !== 'object' || typeof player.constructor.version === 'undefined') {
    log.warn('[shakaPlayer-mux] You must provide a valid shakaPlayer to initShakaPlayerMux.');
    return;
  }

  const getVideoElementProp = (prop) => {
    return player.getMediaElement() && player.getMediaElement()[prop];
  };

  const isPreload = () => {
    const preload = getVideoElementProp('preload');

    return (preload === 'auto' || preload === 'metadata');
  };

  // Accessor for event namespace if used by your player
  const SHAKAPLAYER_EVENTS = {
    STATE_CHANGE_LOAD: 'load'
  };

  // Prepare the data passed in
  options = options || {};

  options.data = assign({
    player_software_name: 'Shaka Player',
    player_software_version: player.constructor.version, // Replace with method to retrieve the version of the player as necessary
    player_mux_plugin_name: 'shakaplayer-mux',
    player_mux_plugin_version: '[AIV]{version}[/AIV]'
  }, options.data);

  // Retrieve the ID and the player element
  const playerID = generateShortId(); // Replace with your own ID if you have one that's unique per player in page

  // Enable customers to emit events through the player instance
  player.mux = {};
  player.mux.emit = function (eventType, data) {
    mux.emit(playerID, eventType, data);
  };

  // Allow mux to retrieve the current time - used to track buffering from the mux side
  // Return current playhead time in milliseconds
  options.getPlayheadTime = () => {
    return secondsToMs(getVideoElementProp('currentTime'));
  };

  options.getStateData = () => {
    return {
      // Required properties - these must be provided every time this is called
      // You _should_ only provide these values if they are defined (i.e. not 'undefined')
      player_is_paused: getVideoElementProp('paused'), // Return whether the player is paused, stopped, or complete (i.e. in any state that is not actively trying to play back the video)
      player_width: getVideoElementProp('offsetWidth'), // Return the width, in pixels, of the player on screen
      player_height: getVideoElementProp('offsetHeight'), // Return the height, in pixels, of the player on screen
      video_source_height: player.getStats().height, // Return the height, in pixels, of the current rendition playing in the player
      video_source_width: player.getStats().width, // Return the height, in pixels, of the current rendition playing in the player

      // Preferred properties - these should be provided in this callback if possible
      // If any are missing, that is okay, but this will be a lack of data for the customer at a later time
      player_is_fullscreen: document.fullscreenElement && (document.fullscreenElement === player.getMediaElement()), // Return true if the player is fullscreen
      player_autoplay_on: getVideoElementProp('autoplay'), // Return true if the player is autoplay
      player_preload_on: isPreload(), // Return true if the player is preloading data (metadata, on, auto are all "true")
      video_source_url: player.getAssetUri(), // Return the playback URL (i.e. URL to master manifest or MP4 file)
      // video_source_mime_type: player.src().mimeType, // Return the mime type (if possible), otherwise the source type (hls, dash, mp4, flv, etc)
      video_source_duration: secondsToMs(getVideoElementProp('duration')), // Return the duration of the source as reported by the player (could be different than is reported by the customer)

      // Optional properties - if you have them, send them, but if not, no big deal
      video_poster_url: getVideoElementProp('poster'), // Return the URL of the poster image used
      player_language_code: getVideoElementProp('lang') // Return the language code (e.g. `en`, `en-us`)
    };
  };

  // The following are linking events that the Mux core SDK requires with events from the player.
  // There may be some cases where the player will send the same Mux event on multiple different
  // events at the player level (e.g. mux.emit('play') may be as a result of multiple player events)
  // OR multiple mux events will be sent as the result of a single player event (e.g. if there is
  // a single event for breaking to a midroll ad, and mux requires a `pause` and an `adbreakstart` event both)

  const attachMediaElementEvents = () => {
    const video = player.getMediaElement();

    if (!video) {
      return log.warn('[shakaPlayer-mux] Unable to getMediaElement() on shaka.Player instance when attempting to attachMediaElementEvents()');
    }

    // Emit the `pause` event when the player is instructed to pause playback. Examples are:
    // 1) User clicks pause to halt playback
    // 2) Playback of content is paused in order to break to an ad (may require simulating the `pause` event when the ad break starts if player is not explicitly paused)
    video.addEventListener('pause', () => player.mux.emit('pause'));

    // Emit the `play` event when the player is instructed to start playback of the content. Examples are:
    // 1) Initial playback of the content via an autoplay mechanism
    // 2) The user clicking play on the player
    // 3) The user resuming playback of the video (by clicking play) after the player has been paused
    // 4) Content playback is resuming after having been paused for an ad to be played inline (may require additional event tracking than the one below)
    video.addEventListener('play', () => player.mux.emit('play'));

    // Emit the `playing` event when the player begins actual playback of the content after the most recent
    // `play` event. This should refer to when the first frame is displayed to the user (and when the next
    // frame is presented for resuming from a paused state)
    // NOTE: some players do not have an accurate `playing` event to use. In these scenarios, we typically track
    // the first timeupdate with a playhead progression as the `playing` event, but send the event with a
    // viewer_time back in time by the progressed amount. See below:
    video.addEventListener('playing', () => player.mux.emit('playing'));

    // Emit the `seeking` event when the player begins seeking to a new position in playback
    video.addEventListener('seeking', () => player.mux.emit('seeking'));

    // Emit the `seeked` event when the player completes the seeking event (the new playhead position
    // is available, and the player is beginnig to play back at the new location)
    video.addEventListener('seekedEvent', () => player.mux.emit('seeked'));

    // Emit the `timeupdate` event when the current playhead position has progressed in playback
    // This event should happen at least every 250 milliseconds
    video.addEventListener('timeupdate', () => {
      player.mux.emit('timeupdate', {
        player_playhead_time: video.currentTime // If you have the time passed in as a param to your event, use that
      });
    });

    // Emit the `ended` event when the current asset has played to completion,
    // without error.
    video.addEventListener('ended', () => player.mux.emit('ended'));
  };

  // Emit the `playerready` event when the player has finished initialization and is ready to begin
  // playback.
  player.addEventListener('onstatechange', (evt) => {
    if (evt.state === SHAKAPLAYER_EVENTS.STATE_CHANGE_LOAD) {
      player.mux.emit('playerready');
      attachMediaElementEvents();
    }
  });

  const extractErrorMessage = (error) => {
    if (error.message) return error.message;
    const categoryNumber = error.category;
    let message;
    try {
      for (const categoryName in shaka.util.Error.Category) {
        if (shaka.util.Error.Category[categoryName] === categoryNumber) {
          message = categoryName
          break;
        }
      }
    } catch (e) {
      log.warn('[shakaPlayer-mux] Error converting category to error message', e);
    }
    return message || categoryNumber;
  };

  const handleError = function (error) {
    player.mux.emit('error', {
      player_error_code: error && error.code, // The code of the error
      player_error_message: error && extractErrorMessage(error) // The message of the error
    });
  };

  // Emit the `error` event when the current playback has encountered a fatal
  // error. Ensure to pass the error code and error message to Mux in this
  // event. You _must_ include at least one of error code and error message
  // (but both is better)
  player.addEventListener('error', (event) => {
    const error = event.detail;
    handleError(error);
  });

  const loadErrorHandler = handleError;

  // Lastly, initialize the tracking
  mux.init(playerID, options);
  return loadErrorHandler;
};


export default initShakaPlayerMux;
