import { effectType } from './effect-creators';
import { effectsToGenerator } from './utils/effects-utils';
import { mapObject } from './utils/mapObject';

function isCompositeEffect(plainEffect) {
    return (
        plainEffect.type === effectType.FORK ||
        plainEffect.type === effectType.CALL
    );
}

function createPlainEffectMap(selector) {
    return function mapPlainEffect(plainEffect) {
        if (isCompositeEffect(plainEffect)) {
            const mappedChildren = plainEffect.generator::map(selector);
            return { ...plainEffect, generator: mappedChildren };
        }
        const plainEffectMapper = createPlainEffectMap(selector);
        if (Array.isArray(plainEffect)) {
            return plainEffect.map(x => {
                if (typeof x === 'function') {
                    return x::map(selector);
                }
                return plainEffectMapper(x);
            });
        }
        if (plainEffect.type === effectType.RACE) {
            return {
                ...plainEffect,
                contenders: mapObject(plainEffectMapper, plainEffect.contenders),
            };
        }
        return selector(plainEffect);
    };
}

export function map(selector) {
    const effects = this; // eslint-disable-line consistent-this,no-invalid-this
    const mapPlainEffect = createPlainEffectMap(selector);

    return function* mappedGenerator() {
        const generator = effectsToGenerator(effects)();
        if (generator.then) {
            return yield generator;
        }

        let next = generator.next();
        let nextArgument;
        while (!next.done) {
            try {
                nextArgument = yield mapPlainEffect(next.value);
                next = generator.next(nextArgument);
            }
            catch (error) {
                next = generator.throw(error);
            }
        }
        return next.value;
    };
}

export function mapIf(condition, func) {
    return this::map(x => condition(x) ? func(x) : x); // eslint-disable-line no-invalid-this
}
