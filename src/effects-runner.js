import { effectType } from './effect-creators';
import { first } from './utils/self-made-actions-observable';
import { effectsToGenerator } from './utils/effects-utils';

class Task {
    constructor(promiseObject) {
        this.promiseObject = promiseObject;
    }

    async join() {
        return await this.promiseObject;
    }
}

// TODO
// eslint-disable-next-line max-params
async function processPlainSideEffect(
    effect, dispatch, getState, actionObservable, effectsHandler) {
    if (effect.then) {
        return await effect;
    }
    if (effectsHandler) {
        const handleResult = effectsHandler(effect);
        if (!handleResult.__NOT_PROCESSED__) {
            return handleResult;
        }
    }
    if (Array.isArray(effect)) {
        const effectPromises = effect
            .map(x => runEffects(x, dispatch, getState, actionObservable));
        return await Promise.all(effectPromises);
    }
    if (effect.type === effectType.PUT) {
        return dispatch(effect.action);
    }
    if (effect.type === effectType.CALL) {
        return runEffects(
            effect.generator, dispatch, getState, actionObservable);
    }
    if (effect.type === effectType.TAKE) {
        const takenAction = await actionObservable::first(effect.condition);
        return effect.map(takenAction);
    }
    if (effect.type === effectType.SELECT) {
        return effect.selector(getState());
    }
    if (effect.type === effectType.FORK) {
        const resultPromise =
            runEffects(
                effect.generator, dispatch, getState, actionObservable);
        return new Task(resultPromise);
    }
    if (effect.type === effectType.JOIN) {
        return effect.task.join();
    }
    if (effect.type === effectType.NOOP) {
        return undefined;
    }
    if (effect.type === effectType.RACE) {
        const constructorNames = Object.keys(effect.contenders);
        const effectPromises = Object.values(effect.contenders)
            .map(x => runEffects(x, dispatch, getState, actionObservable))
            .map((promise, i) => promise.then(data => ({ [constructorNames[i]]: data })));
        return Promise.race(effectPromises);
    }
    throw `Uncatched side effect: ${JSON.stringify(effect)}`;
}

// TODO
// eslint-disable-next-line max-params
async function runEffects(
    effect, dispatch, getState, actionObservable, effectsHandler) {
    const generator = effectsToGenerator(effect)();
    if (generator.then) {
        return await generator;
    }

    let next = generator.next();
    let nextArgument;
    while (!next.done) {
        try {
            nextArgument = await processPlainSideEffect(
                next.value, dispatch, getState, actionObservable, effectsHandler);
            next = generator.next(nextArgument);
        }
        catch (exception) {
            next = generator.throw(exception);
        }
    }
    return next.value;
}

export default runEffects;
