import { Fiber } from "react-reconciler/react-internal-types";

type EventProps = { [key: string]: any };
type EventCallback = (event: EventProps) => any;

type EventInterfaceType = {
  [key: string]: 0 | EventCallback;
};

const EventInterface: EventInterfaceType = {
  eventPhase: 0,
  bubbles: 0,
  cancelable: 0,
  timeStamp: function (event: EventProps) {
    return event.timeStamp || Date.now();
  },
  defaultPrevented: 0,
  isTrusted: 0,
};

const MouseEventInterface: EventInterfaceType = {
  button: 0,
  buttons: 0,
  // TODO 待补充完全
};

export const SyntheticEvent = createSyntheticEvent(EventInterface);

export const SyntheticMouseEvent = createSyntheticEvent(MouseEventInterface);

/**
 * 创建各种合成事件来替代原生对象 event
 * @param Interface
 * @returns
 */
function createSyntheticEvent(Interface: EventInterfaceType) {
  class SyntheticBaseEvent {
    public _reactName: string | null = null;

    public _targetInst: Fiber | null = null;

    public type: string;

    public nativeEvent: { [propName: string]: any } & Event;

    public target: null | EventTarget;

    public currentTarget: EventTarget | null = null;

    public isPropagationStopped: () => boolean;

    [key: string]: any;

    constructor(
      reactName: string | null,
      reactEventType: string,
      targetInst: Fiber | null,
      nativeEvent: { [propName: string]: any } & Event,
      nativeEventTarget: null | EventTarget
    ) {
      this._reactName = reactName;
      this._targetInst = targetInst;
      this.type = reactEventType;
      this.nativeEvent = nativeEvent;
      this.target = nativeEventTarget;

      for (const propName in Interface) {
        if (!(Interface as Object).hasOwnProperty(propName)) {
          continue;
        }
        const normalize = Interface[propName];

        if (normalize) {
          this[propName] = normalize(nativeEvent);
        } else {
          this[propName] = nativeEvent[propName];
        }
      }

      const defaultPrevented =
        nativeEvent.defaultPrevented != null
          ? nativeEvent.defaultPrevented
          : nativeEvent.returnValue === false;

      if (defaultPrevented) {
        this.isDefaultPrevented = functionThatReturnsTrue;
      } else {
        this.isDefaultPrevented = functionThatReturnsFalse;
      }
      this.isPropagationStopped = functionThatReturnsFalse;
    }

    preventDefault() {
      this.defaultPrevented = true;
      const event = this.nativeEvent;
      if (!event) {
        return;
      }

      if (event.preventDefault) {
        event.preventDefault();
      }

      this.isDefaultPrevented = functionThatReturnsTrue;
    }

    stopPropagation() {
      const event = this.nativeEvent;
      if (!event) return;

      if (event.stopPropagation) {
        event.stopPropagation();
      }

      this.isPropagationStopped = functionThatReturnsTrue;
    }

    persist() {}

    isPersistent = functionThatReturnsTrue;
  }

  return SyntheticBaseEvent;
}

function functionThatReturnsTrue() {
  return true;
}

function functionThatReturnsFalse() {
  return false;
}
