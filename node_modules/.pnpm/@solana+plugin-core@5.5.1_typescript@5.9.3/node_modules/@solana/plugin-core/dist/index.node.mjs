// src/client.ts
function createEmptyClient() {
  return addUse({});
}
function addUse(value) {
  return Object.freeze({
    ...value,
    use(plugin) {
      const result = plugin(value);
      return result instanceof Promise ? createAsyncClient(result) : addUse(result);
    }
  });
}
function createAsyncClient(promise) {
  return Object.freeze({
    catch(onrejected) {
      return promise.then((v) => addUse(v)).catch(onrejected);
    },
    finally(onfinally) {
      return promise.then((v) => addUse(v)).finally(onfinally);
    },
    then(onfulfilled, onrejected) {
      return promise.then((v) => addUse(v)).then(onfulfilled, onrejected);
    },
    use(plugin) {
      return createAsyncClient(promise.then(plugin));
    }
  });
}

export { createEmptyClient };
//# sourceMappingURL=index.node.mjs.map
//# sourceMappingURL=index.node.mjs.map