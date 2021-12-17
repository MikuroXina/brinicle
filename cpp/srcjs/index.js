/* @flow */
"use strict";
import { NativeModules, NativeEventEmitter } from 'react-native-macos';
import EventEmitter from 'react-native-macos/Libraries/vendor/emitter/EventEmitter';

const KernelRCTManager = NativeModules.KernelRCTManager;
const KernelRCTEvents = new NativeEventEmitter(KernelRCTManager);

class KernelManager extends EventEmitter {
  constructor() {
    super();
    this.parameterInfo = KernelRCTManager.parameterInfo;
    this.grabs = {};
    this.parameters = {};
    this.loaded = false;
    this.onLoadedListeners = [];

    const checkLoaded = () => {
      for (const paramID of Object.keys(this.parameterInfo)) {
        if (!(paramID in this.parameters)) {
          return false;
        }
      }
      return true;
    };
    KernelRCTEvents.addListener('AURCTParamChanged', (event) => {
      const identifier = event.identifier;
      const value = event.value;
      this.parameters[identifier] = value;
      const wasLoaded = this.loaded;
      this.loaded = checkLoaded();
      if (this.loaded && !wasLoaded) {
        for (const f of this.onLoadedListeners) {
          f();
        }
        this.onLoadedListeners = [];
      }
      if (this.loaded) {
        this.emit('changed');
      }
    });
    KernelRCTManager.sendAllParams();
  }

  /**
   * If loaded, calls f on next event loop.  Otherwise, calls f when loaded.
   * @param {Function} f The callback.
   */
  onload(f) {
    if (this.loaded) {
      setTimeout(f);
    } else {
      this.onLoadedListeners.push(f);
    }
  }

  /**
   *
   * @param {string} identifier
   * @param {number} value
   */
  setParameter(identifier, value) {
    if (!this.loaded) {
      return;
    }
    if (this.parameters[identifier] == value) {
      return;
    }
    this.parameters[identifier] = value;
    KernelRCTManager.setParameter(identifier, value);
    this.emit('changed');
  }

  /**
   * Grabs the parameter of the given identifier.
   * @param {string} identifier
   * @returns {Promise<number>} Resolved with the grab number of the given identifier.
   */
  async grabParameter(identifier) {
    const g = await KernelRCTManager.grabParameter(identifier);
    this.grabs[g] = identifier;
    return g;
  }

  /**
   * Moves the grabbed parameter with the given value.
   * @param {number} grab The grab number.
   * @param {number} value The value to overwrite.
   * @returns {Promise<void>} Resolved when the movement is done.
   */
  async moveGrabbedParameter(grab, value) {
    await KernelRCTManager.moveGrabbedParameter(grab, value);
    if (!this.grabs[grab]) {
      return;
    }
    const identifier = this.grabs[grab];
    if (this.parameters[identifier] == value) {
      return;
    }
    this.parameters[identifier] = value;
    this.emit('changed');
  }

  /**
   *
   * @param {number} grab The grab number.
   * @returns {Promise<void>} Resolved when the ungrabbing is done.
   */
  async ungrabParameter(grab) {
    await KernelRCTManager.ungrabParameter(grab);
      delete this.grabs[grab];
  }

};

const GlobalKernelManager = new KernelManager();

export default GlobalKernelManager;
