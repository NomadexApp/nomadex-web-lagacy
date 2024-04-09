import { knownPools } from "$lib";
import { get } from "svelte/store";
import { lastActiveAnalyticsPair, lastActiveLimitOrderPair, lastActiveSwapPair } from "./stores";

const defaultToken = 'VIA';

export function getLastActivePair(group: string, val: string) {
    val;
    let pair = '';

    switch (group) {
        case 'swap':
            pair = get(lastActiveSwapPair);
            break;
        case 'analytics':
            pair = get(lastActiveAnalyticsPair);
            break;
        case 'limit':
            pair = get(lastActiveLimitOrderPair);
            break;
    }

    const pools = get(knownPools);
    if (pair) {
        const _pools = pair
            .split('-')
            .map((sym) => pools.find((pool) => pool.arc200Asset.symbol === sym))
            .filter((pool) => pool);
        if (_pools.length) return pair;
    }

    if (group === 'swap') {
        return `VOI-${defaultToken}`;
    }

    return defaultToken;
}