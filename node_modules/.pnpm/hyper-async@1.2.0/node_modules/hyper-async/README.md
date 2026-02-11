# hyper-async

Async is a tiny FP library for javascript. It provides a small, composable abstraction over async effects with predictable error handling and strict composition semantics.

## install

```sh
npm install hyper-async
```

## Usage

### Composition and errors

- `map(fn)`: `fn` must be a function. Sync throws inside `fn` are caught and become a rejected Async.
- `chain(fn)`: `fn` must return an `Async`. If it returns anything else, the chain rejects with a `TypeError`.
- `bimap(rejFn, resFn)`: both args must be functions.
- `bichain(rejFn, resFn)`: both args must return `Async`.
- `fold(rejFn, resFn)`: both args must return `Async`.
- `fromPromise(f)`: `f` must be a function; sync throws reject the `Async`.

Errors never escape; they surface as a rejected `Async` (and thus a rejected `.toPromise()`).

```js
import Async from "hyper-async";

const prop = (k) => (o) => o[k];

async function main() {
  const x = await Async.of(1)
    .chain((n) => Async.fromPromise(fetch)(`https://example.test/posts/${n}`))
    .chain((res) => Async.fromPromise(res.json.bind(res))())
    .map(prop("title"))
    .toPromise();
  console.log(x);
}

main();
```
