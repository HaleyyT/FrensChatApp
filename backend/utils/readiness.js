let isReady = false;

export function setServiceReady(ready) {
  isReady = ready;
}

export function isServiceReady() {
  return isReady;
}
