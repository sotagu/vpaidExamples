/**
 * @fileoverview A VPAID ad useful for testing functionality of the sdk.
 * This particular ad will just play a video.
 *
 * @author ryanthompson@google.com (Ryan Thompson)
 */



/**
 * @constructor
 */
var VpaidLinearAd = function() {
  /**
   * The slot is the div element on the main page that the ad is supposed to
   * occupy.
   * @type {Object}
   * @private
   */
  this.slot_ = null;

  /**
   * The video slot is the video element used by the ad to render video content.
   * @type {Object}
   * @private
   */
  this.videoSlot_ = null;

  /**
   * An object containing all registered events.  These events are all
   * callbacks for use by the VPAID ad.
   * @type {Object}
   * @private
   */
  this.eventsCallbacks_ = {};

  /**
   * A list of getable and setable attributes.
   * @type {Object}
   * @private
   */
  this.attributes_ = {
    'companions' : '',
    'desiredBitrate' : 256,
    'duration': 6,
    'expanded' : false,
    'height' : 0,
    'icons' : false,
    'linear' : true,
    'remainingTime' : 13,
    'skippableState' : false,
    'viewMode' : 'normal',
    'width' : 0,
    'volume' : 1.0
  };

  /**
   * @type {?number} id of the interval used to synch remaining time
   * @private
   */
  this.intervalId_ = null;

  /**
   * A set of events to be reported.
   * @type {Object}
   * @private
   */
  this.quartileEvents_ = [
    {event: 'AdImpression', value: 0},
    {event: 'AdVideoStart', value: 0},
    {event: 'AdVideoFirstQuartile', value: 25},
    {event: 'AdVideoMidpoint', value: 50},
    {event: 'AdVideoThirdQuartile', value: 75},
    {event: 'AdVideoComplete', value: 100}
  ];

  /**
   * @type {number} An index into what quartile was last reported.
   * @private
   */
  this.lastQuartileIndex_ = 0;

  /**
   * An array of urls and mimetype pairs.
   *
   * @type {!object}
   * @private
   */
  this.parameters_ = {};
};


/**
 * VPAID defined init ad, initializes all attributes in the ad.  The ad will
 * not start until startAd is called.
 *
 * @param {number} width The ad width.
 * @param {number} height The ad heigth.
 * @param {string} viewMode The ad view mode.
 * @param {number} desiredBitrate The desired bitrate.
 * @param {Object} creativeData Data associated with the creative.
 * @param {Object} environmentVars Variables associated with the creative like
 *     the slot and video slot.
 */
VpaidLinearAd.prototype.initAd = function(
    width,
    height,
    viewMode,
    desiredBitrate,
    creativeData,
    environmentVars) {
  // slot and videoSlot are passed as part of the environmentVars
  this.attributes_['width'] = width;
  this.attributes_['height'] = height;
  this.attributes_['viewMode'] = viewMode;
  this.attributes_['desiredBitrate'] = desiredBitrate;
  this.slot_ = environmentVars.slot;
  this.videoSlot_ = environmentVars.videoSlot;

  // Parse the incoming parameters.
  this.parameters_ = JSON.parse(creativeData['AdParameters']);

  this.log('initAd ' + width + 'x' + height +
      ' ' + viewMode + ' ' + desiredBitrate);
  this.updateVideoSlot_();
  this.videoSlot_.addEventListener(
      'timeupdate',
      this.timeUpdateHandler_.bind(this),
      false);
  this.videoSlot_.addEventListener(
      'ended',
      this.stopAd.bind(this),
      false);
  this.videoSlot_.addEventListener(
      'play',
      this.videoResume_.bind(this),
      false);
  this.callEvent_('AdLoaded');
};


/**
 * Called when the overlay is clicked.
 * @private
 */
VpaidLinearAd.prototype.overlayOnClick_ = function() {
  if ('AdClickThru' in this.eventsCallbacks_) {
    this.eventsCallbacks_['AdClickThru']('','0', true);
  };
};


/**
 * Called by the video element.  Calls events as the video reaches times.
 * @private
 */
VpaidLinearAd.prototype.timeUpdateHandler_ = function() {
  this.attributes_['remainingTime'] =
      this.videoSlot_.duration - this.videoSlot_.currentTime;
  if (this.lastQuartileIndex_ >= this.quartileEvents_.length) {
    return;
  }
  var percentPlayed =
      this.videoSlot_.currentTime * 100.0 / this.videoSlot_.duration;
  if (percentPlayed >= this.quartileEvents_[this.lastQuartileIndex_].value) {
    var lastQuartileEvent = this.quartileEvents_[this.lastQuartileIndex_].event;
    this.eventsCallbacks_[lastQuartileEvent]();
    this.lastQuartileIndex_ += 1;
  }
  if (this.attributes_['duration'] != this.videoSlot_.duration) {
    this.attributes_['duration'] = this.videoSlot_.duration;
    this.callEvent_('AdDurationChange');
  }
};


/**
 * @private
 */
VpaidLinearAd.prototype.updateVideoSlot_ = function() {
  if (this.videoSlot_ == null) {
    this.videoSlot_ = document.createElement('video');
    this.log('Warning: No video element passed to ad, creating element.');
    this.slot_.appendChild(this.videoSlot_);
  }
  // TODO right now the sdk is sending in the wrong size on init.
  // there should be no need to change element sizes from the start.
  //this.updateVideoPlayerSize_();
  var foundSource = false;
  var videos = this.parameters_.videos || [];
  for (var i = 0; i < videos.length; i++) {
    // Choose the first video with a supported mimetype.
    if (this.videoSlot_.canPlayType(videos[i].mimetype) != '') {
      this.videoSlot_.setAttribute('src', videos[i].url);
      foundSource = true;
      break;
    }
  }
  if (!foundSource) {
    // Unable to find a source video.
    this.callEvent_('AdError');
  }
};


/**
 * Helper function to update the size of the video player.
 * @private
 */
VpaidLinearAd.prototype.updateVideoPlayerSize_ = function() {
  try {
    this.videoSlot_.setAttribute('width', this.attributes_['width']);
    this.videoSlot_.setAttribute('height', this.attributes_['height']);
    this.videoSlot_.style.width = this.attributes_['width'] + 'px';
    this.videoSlot_.style.height = this.attributes_['height'] + 'px';
  } catch (e) { /* no op*/}
};


/**
 * Returns the versions of VPAID ad supported.
 * @param {string} version
 * @return {string}
 */
VpaidLinearAd.prototype.handshakeVersion = function(version) {
  return ('2.0');
};


/**
 * Called by the wrapper to start the ad.
 */
VpaidLinearAd.prototype.startAd = function() {
  this.log('Starting ad');


  let container = document.createElement('div');
  container.innerHTML = `
<div class="container">
  <div class="disclosure-container">
    <a class="disclosure-link" href="https://www.outbrain.com/what-is/" target="_blank">
    <img class="ob-logo" src="https://widgets.outbrain.com/images/widgetIcons/OB-Logo-2019-Web-Orange.png"/></a>
  </div>
  <div class="thumbnail-container">
    <img class="thumbnail" src="${this.parameters_.ads[0].thumbnailUrl || ''}"/>
  </div>
  <div class="text-container">
    <div class="title">
    ${this.parameters_.ads[0].title || ''}
    </div>
    <div class="source">
    ${this.parameters_.ads[0].sourceName || ''}
    </div>
    <div class="cta">
      Read More
    </div>
  </div>
</div>`

let css = `.container{box-sizing:border-box;position:relative;display:grid;grid-template-columns:380px 1fr;grid-template-rows:360px}.disclosure-container{position:absolute;top:0;left:0;z-index:100}.disclosure-link{display:block;padding:4px 6px;background-color:rgba(255,255,255,.3)}.ob-logo{width:80px}.thumbnail-container{overflow:hidden}.thumbnail{max-width:100%;max-height:100%;animation:zoom 6s ease-out}.text-container{box-sizing:border-box;padding:2%;height:100%;display:grid;align-content:center;grid-gap:.8rem;text-align:center;font:1.2rem/1.25 Arial,sans-serif;color:#fff;background-color:#666;animation:bgchange 4s}.title{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;overflow:hidden;font-weight:700}.source{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-size:.9rem}.cta{position:relative;border:1px solid #fff;border-radius:8px;padding:4px 0;animation:.8s ease-out 2s both slideinbottom}@keyframes bgchange{from{background-color:#fff}to{background-color:#666}}@keyframes slideinbottom{from{bottom:-300px;opacity:0}to{bottom:0;opacity:1}}@keyframes zoom{from{transform:scale(1.1)}to{transform:scale(1)}}`
var style = document.createElement('style');
style.type = 'text/css';
if (style.styleSheet) {
  style.styleSheet.cssText = css;
} else {
  style.appendChild(document.createTextNode(css));
}
this.slot_.appendChild(style);

this.slot_.appendChild(container);

  this.videoSlot_.play();
  // var img = document.createElement('img');
  // img.src = this.parameters_.overlay || '';
  // this.slot_.appendChild(img);
  // img.addEventListener('click', this.overlayOnClick_.bind(this), false);

  //add a test mute button
  // var muteButton = document.createElement('input');
  // muteButton.setAttribute('type', 'button');
  // muteButton.setAttribute('value', 'mute/unMute');

  // muteButton.addEventListener('click',
  //     this.muteButtonOnClick_.bind(this),
  //     false);
  // this.slot_.appendChild(muteButton);

  this.callEvent_('AdStarted');
};


/**
 * Called by the wrapper to stop the ad.
 */
VpaidLinearAd.prototype.stopAd = function() {
  this.log('Stopping ad');
  if (this.intervalId_){
    clearInterval(this.intervalId_)
  }
  // Calling AdStopped immediately terminates the ad. Setting a timeout allows
  // events to go through.
  var callback = this.callEvent_.bind(this);
  setTimeout(callback, 75, ['AdStopped']);
};


/**
 * @param {number} value The volume in percentage.
 */
VpaidLinearAd.prototype.setAdVolume = function(value) {
  this.attributes_['volume'] = value;
  this.log('setAdVolume ' + value);
  this.videoSlot_.volume = value / 100.0;
  this.callEvent_('AdVolumeChange');
};


/**
 * @return {number} The volume of the ad.
 */
VpaidLinearAd.prototype.getAdVolume = function() {
  this.log('getAdVolume');
  return this.attributes_['volume'];
};


/**
 * @param {number} width The new width.
 * @param {number} height A new height.
 * @param {string} viewMode A new view mode.
 */
VpaidLinearAd.prototype.resizeAd = function(width, height, viewMode) {
  this.log('resizeAd ' + width + 'x' + height + ' ' + viewMode);
  this.attributes_['width'] = width;
  this.attributes_['height'] = height;
  this.attributes_['viewMode'] = viewMode;
  this.updateVideoPlayerSize_();
  this.callEvent_('AdSizeChange');
};


/**
 * Pauses the ad.
 */
VpaidLinearAd.prototype.pauseAd = function() {
  this.log('pauseAd');
  this.videoSlot_.pause();
  this.callEvent_('AdPaused');
  if (this.intervalId_){
    clearInterval(this.intervalId_)
  }
};


/**
 * Resumes the ad.
 */
VpaidLinearAd.prototype.resumeAd = function() {
  this.log('resumeAd');
  this.videoSlot_.play();
  this.callEvent_('AdPlaying');
  var callback = (function(){
    this.attributes_['remainingTime'] -= 0.25;
    this.callEvent_('AdRemainingTimeChange');
  }).bind(this);
  this.intervalId_ = setInterval(callback, 250);
};


/**
 * Expands the ad.
 */
VpaidLinearAd.prototype.expandAd = function() {
  this.log('expandAd');
  this.attributes_['expanded'] = true;
  if (elem.requestFullscreen) {
    elem.requestFullscreen();
  }
  this.callEvent_('AdExpanded');
};


/**
 * Returns true if the ad is expanded.
 * @return {boolean}
 */
VpaidLinearAd.prototype.getAdExpanded = function() {
  this.log('getAdExpanded');
  return this.attributes_['expanded'];
};


/**
 * Returns the skippable state of the ad.
 * @return {boolean}
 */
VpaidLinearAd.prototype.getAdSkippableState = function() {
  this.log('getAdSkippableState');
  return this.attributes_['skippableState'];
};


/**
 * Collapses the ad.
 */
VpaidLinearAd.prototype.collapseAd = function() {
  this.log('collapseAd');
  this.attributes_['expanded'] = false;
};


/**
 * Skips the ad.
 */
VpaidLinearAd.prototype.skipAd = function() {
  this.log('skipAd');
  var skippableState = this.attributes_['skippableState'];
  if (skippableState) {
    this.callEvent_('AdSkipped');
  }
};


/**
 * Registers a callback for an event.
 * @param {Function} aCallback The callback function.
 * @param {string} eventName The callback type.
 * @param {Object} aContext The context for the callback.
 */
VpaidLinearAd.prototype.subscribe = function(
    aCallback,
    eventName,
    aContext) {
  this.log('Subscribe ' + aCallback);
  var callBack = aCallback.bind(aContext);
  this.eventsCallbacks_[eventName] = callBack;
};


/**
 * Removes a callback based on the eventName.
 *
 * @param {string} eventName The callback type.
 */
VpaidLinearAd.prototype.unsubscribe = function(eventName) {
  this.log('unsubscribe ' + eventName);
  this.eventsCallbacks_[eventName] = null;
};


/**
 * @return {number} The ad width.
 */
VpaidLinearAd.prototype.getAdWidth = function() {
  return this.attributes_['width'];
};


/**
 * @return {number} The ad height.
 */
VpaidLinearAd.prototype.getAdHeight = function() {
  return this.attributes_['height'];
};


/**
 * @return {number} The time remaining in the ad.
 */
VpaidLinearAd.prototype.getAdRemainingTime = function() {
  return this.attributes_['remainingTime'];
};


/**
 * @return {number} The duration of the ad.
 */
VpaidLinearAd.prototype.getAdDuration = function() {
  return this.attributes_['duration'];
};


/**
 * @return {string} List of companions in vast xml.
 */
VpaidLinearAd.prototype.getAdCompanions = function() {
  return this.attributes_['companions'];
};


/**
 * @return {boolean} A list of icons.
 */
VpaidLinearAd.prototype.getAdIcons = function() {
  return this.attributes_['icons'];
};


/**
 * @return {boolean} True if the ad is a linear, false for non linear.
 */
VpaidLinearAd.prototype.getAdLinear = function() {
  return this.attributes_['linear'];
};


/**
 * Logs events and messages.
 *
 * @param {string} message
 */
VpaidLinearAd.prototype.log = function(message) {
  console.log(message);
};


/**
 * Calls an event if there is a callback.
 * @param {string} eventType
 * @private
 */
VpaidLinearAd.prototype.callEvent_ = function(eventType) {
  if (eventType in this.eventsCallbacks_) {
    this.eventsCallbacks_[eventType]();
  }
};


/**
 * Callback for when the mute button is clicked.
 * @private
 */
VpaidLinearAd.prototype.muteButtonOnClick_ = function() {
  if (this.attributes_['volume'] == 0) {
    this.attributes_['volume'] = 1.0;
    this.videoSlot_.volume = 1.0;
  } else {
    this.attributes_['volume'] = 0.0;
    this.videoSlot_.volume = 0.0;
  }
  this.callEvent_('AdVolumeChange');
};


/**
 * Callback when the video element calls start.
 * @private
 */
VpaidLinearAd.prototype.videoResume_ = function() {
  this.log("video element resumed.");
};


/**
 * Main function called by wrapper to get the VPAID ad.
 * @return {Object} The VPAID compliant ad.
 */
var getVPAIDAd = function() {
  return new VpaidLinearAd();
};

