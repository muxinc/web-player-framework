import assign from 'lodash.assign';
import window from 'global/window'; // Remove if you do not need to access the global `window`
import document from 'global/document'; // Remove if you do not need to access the global `document`
import mux from 'mux-embed';

// Helper function to generate "unique" IDs for the player if your player does not have one built in
let generateShortID = function () {
  return ('000000' + (Math.random() * Math.pow(36, 6) << 0).toString(36)).slice(-6);
};

module.exports = (function () {
  const log = mux.utils.log;
  const secondsToMs = mux.utils.secondsToMs;
  const getComputedStyle = mux.utils.getComputedStyle; // Helper function, same return as getComputedStyle in HTML5

  const initYourPlayerMux = function (player, options) {
    // Make sure we got a player - Check properties to ensure that a player was passed
    if (typeof player !== 'object' || typeof player.getVersion !== 'function') {
      log.warn('[yourPlayer-mux] You must provide a valid yourPlayer to initYourPlayerMux.');
      return;
    }

    // Accessor for event namespace if used by your player
    // const YOURPLAYER_EVENTS = || {};

    // Prepare the data passed in
    options = options || {};

    options.data = assign({
      player_software_name: 'Your Player',
      player_software_version: player.getVersion(), // Replace with method to retrieve the version of the player as necessary
      player_mux_plugin_name: 'yourplayer-mux',
      player_mux_plugin_version: '__VERSION__'
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
      return secondsToMs(player.currentTime());
    };

    // Allow mux to automatically retrieve state information about the player on each event sent
    // If these properties are not accessible through getters at runtime, you may need to set them
    // on certain events and store them in a local variable, and return them in the method e.g.
    //    let playerWidth, playerHeight;
    //    player.on('resize', (width, height) => {
    //      playerWidth = width;
    //      playerHeight = height;
    //    });
    //    options.getStateData = () => {
    //      return {
    //        ...
    //        player_width: playerWidth,
    //        player_height: playerHeight
    //      };
    //    };
    options.getStateData = () => {
      return {
        // Required properties - these must be provided every time this is called
        // You _should_ only provide these values if they are defined (i.e. not 'undefined')
        player_is_paused: player.isPaused(), // Return whether the player is paused, stopped, or complete (i.e. in any state that is not actively trying to play back the video)
        player_width: player.getWidth(), // Return the width, in pixels, of the player on screen
        player_width: player.getHeight(), // Return the height, in pixels, of the player on screen
        video_source_height: player.currentSource().height, // Return the height, in pixels, of the current rendition playing in the player
        video_source_width: player.currentSource().width, // Return the height, in pixels, of the current rendition playing in the player

        // Preferred properties - these should be provided in this callback if possible
        // If any are missing, that is okay, but this will be a lack of data for the customer at a later time
        player_is_fullscreen: player.isFullscreen(), // Return true if the player is fullscreen
        player_autoplay_on: player.autoplay(), // Return true if the player is autoplay
        player_preload_on: player.preload(), // Return true if the player is preloading data (metadata, on, auto are all "true")
        video_source_url: player.src().url, // Return the playback URL (i.e. URL to master manifest or MP4 file)
        video_source_mime_type: player.src().mimeType, // Return the mime type (if possible), otherwise the source type (hls, dash, mp4, flv, etc)
        video_source_duration: secondsToMs(player.getDuration()), // Return the duration of the source as reported by the player (could be different than is reported by the customer)

        // Optional properties - if you have them, send them, but if not, no big deal
        video_poster_url: player.poster().url(), // Return the URL of the poster image used
        player_language_code: player.language() // Return the language code (e.g. `en`, `en-us`)
      };
    }

    // The following are linking events that the Mux core SDK requires with events from the player.
    // There may be some cases where the player will send the same Mux event on multiple different
    // events at the player level (e.g. mux.emit('play') may be as a result of multiple player events)
    // OR multiple mux events will be sent as the result of a single player event (e.g. if there is
    // a single event for breaking to a midroll ad, and mux requires a `pause` and an `adbreakstart` event both)

    // Emit the `playerready` event when the player has finished initialization and is ready to begin
    // playback.
    player.on('readyEvent', () => {
      player.mux.emit('playerready');
    });

    // Emit the `pause` event when the player is instructed to pause playback. Examples are:
    // 1) User clicks pause to halt playback
    // 2) Playback of content is paused in order to break to an ad (may require simulating the `pause` event when the ad break starts if player is not explicitly paused)
    player.on('pauseEvent', () => {
      player.mux.emit('pause');
    });

    // Emit the `play` event when the player is instructed to start playback of the content. Examples are:
    // 1) Initial playback of the content via an autoplay mechanism
    // 2) The user clicking play on the player
    // 3) The user resuming playback of the video (by clicking play) after the player has been paused
    // 4) Content playback is resuming after having been paused for an ad to be played inline (may require additional event tracking than the one below)
    player.on('playEvent', () => {
      player.mux.emit('play');
    });

    // Emit the `playing` event when the player begins actual playback of the content after the most recent
    // `play` event. This should refer to when the first frame is displayed to the user (and when the next
    // frame is presented for resuming from a paused state)
    player.on('playingEvent', () => {
      player.mux.emit('playing');
    });
    // NOTE: some players do not have an accurate `playing` event to use. In these scenarios, we typically track
    // the first timeupdate with a playhead progression as the `playing` event, but send the event with a
    // viewer_time back in time by the progressed amount. See below:
    /*
      player.on('playEvent'', () => {
        const playTime = player.getCurrentTime();

        // Listen for the first time update to be able to send PLAYING
        let sendPlaying = (data) => {
          const now = Date.now();
          const currentTime = player.getCurrentTime();
          const timeDiff = currentTime - playTime;

          // Only send playing if we've progressed some
          if (timeDiff > 0) {
            // Unregister so it doesn't keep firing
            player.off('timeupdateEvent', sendPlaying);
            player.mux.emit('playing', {
              viewer_time: now - secondsToMs(timeDiff)
            });
          }
        };

        player.on('timeupdateEvent', sendPlaying);

        // And clear this handler if we happen to get pause, error, seeking, or ended before timeupdate
        player.on('pauseEvent', () => { player.off('timeupdateEvent', sendPlaying); });
        player.on('endedEvent', () => { player.off(timeupdateEvent, sendPlaying); });
        player.on('seekEvent', () => { player.off(timeupdateEvent, sendPlaying); });
        player.on('errorEvent', () => { player.off(timeupdateEvent, sendPlaying); });
      });
    */

    // Emit the `seeking` event when the player begins seeking to a new position in playback
    player.on('seekingEvent', () => {
      player.mux.emit('seeking');
    });

    // Emit the `seeked` event when the player completes the seeking event (the new playhead position
    // is available, and the player is beginnig to play back at the new location)
    player.on('seekedEvent', () => {
      player.mux.emit('seeked');
    });

    // Emit the `timeupdate` event when the current playhead position has progressed in playback
    // This event should happen at least every 250 milliseconds
    player.on('timeupateEvent', () => {
      player.mux.emit('timeupdate', {
        player_playhead_time: player.currentTime() // If you have the time passed in as a param to your event, use that
      });
    });

    // Emit the `error` event when the current playback has encountered a fatal
    // error. Ensure to pass the error code and error message to Mux in this
    // event. You _must_ include at least one of error code and error message
    // (but both is better)
    player.on('errorEvent', () => {
      player.mux.emit('error', {
        player_error_code: player.errorCode(), // The code of the error
        player_error_message: player.errorMessage() // The message of the error
      });
    });

    // Emit the `ended` event when the current asset has played to completion,
    // without error.
    player.on('endedEvent', () => {
      player.mux.emit('ended');
    });

    /* AD EVENTS */
    // Depending on your player, you may have separate ad events to track, or
    // the standard playback events may double as ad events. If the latter is the
    // case, you should track the state of the player (ad vs content) and then
    // just prepend the Mux events above with 'ad' when those events fire and
    // the player is in ad mode.

    // Emit the `adbreakstart` event when the player breaks to an ad slot. This
    // may be directly at the beginning (before a play event) for pre-rolls, or
    // (for both pre-rolls and mid/post-rolls) may be when the content is paused
    // in order to break to ad.
    player.on('adbreakstartEvent', () => {
      // Some players do not emit a pause event when breaking to ad. Please manually
      // emit this if your player does not do this automatically.
      /*
        if (shouldEmitPause) {
          player.mux.emit('pause');
        }
      */
      player.mux.emit('adbreakstart');
    });

    // Emit the `adbreakend` event when the ad break is over and content is about
    // to be resumed.
    player.on('adbreakendEvent', () => {
      player.mux.emit('adbreakend');
      // Some players do not emit a play event when resuming from ad. Please manually
      // emit this if your player does not do this automatically.
      /*
        if (shouldEmitPlay) {
          player.mux.emit('play');
        }
      */
    });

    // Emit the `adplay` event when an individual ad within an ad break is instructed
    // to play. This should match the `play` event, but specific to ads (e.g. should
    // fire on initial play as well as plays after a pause)
    player.on('adplayEvent', () => {
      player.mux.emit('adplay');
    });

    // Emit the `adplaying` event when the current ad begins progressing and displaying
    // frames. This should match the `playing` event, but specific to ads. NOTE:
    // you may need to do the same thing here as with `play` if there is no `adplaying` event
    player.on('adplayingEvent', () => {
      player.mux.emit('adplaying');
    });

    // Emit the `adpause` event when an individual ad within an ad break is instructed
    // to pause. This should match the `pause` event, but specific to ads
    player.on('adpauseEvent', () => {
      player.mux.emit('adpause');
    });

    // Emit the `adended` event when an individual ad within an ad break is played to
    // completion. This should match the `ended` event, but specific to ads
    player.on('adendedEvent', () => {
      player.mux.emit('adended');
    });

    // Emit the `aderror` event when an individual ad within an ad break encounters
    // an error. This should match the `error` event, but specific to ads
    player.on('aderrorEvent', () => {
      player.mux.emit('aderror');
    });

    // If your player has a destroy/dispose event to clean up the player, pass
    // this on to Mux as a `destroy` event.
    player.on('destroyEvent', () => {
      // Turn off all listeners for your player if that's possible/needed
      // Then emit `destroy`
      player.mux.emit('destroy');
    });

    // Lastly, initialize the tracking
    mux.init(playerID, options);
  };

  return initYourPlayerMux;
})();
