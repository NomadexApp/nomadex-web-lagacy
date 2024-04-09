import { sha512_256 } from 'js-sha512';
import { indexerClient, nodeClient } from './_shared';
import algosdk from 'algosdk';
import { browser } from '$app/environment';

export type SwapTxn = {
	'close-rewards': number;
	'closing-amount': number;
	'confirmed-round': number;
	'created-application-index': number;
	fee: number;
	id: string;
	'intra-round-offset': number;
	'receiver-rewards': number;
	'round-time': number;
	sender: string;
	'sender-rewards': number;
	signature: { sig: string };
	'tx-type': string;
	logs?: string[];
};

interface CacheStructure {
	lastRound: number;
	txns: SwapTxn[];
}

export class SwapEvents {
	static async setCache(update: CacheStructure, appId: number, signature: string) {
		if (!browser) return;

		const key = `${appId}-${signature}`;
		localStorage.removeItem(key);

		const cached = await caches.open(key);
		await cached.put(`/${key}`, new Response(JSON.stringify(update)));
	}

	static async getCache(appId: number, signature: string): Promise<CacheStructure> {
		const defaultRet = { lastRound: 2000000, txns: [] };
		if (!browser) return defaultRet;

		const key = `${appId}-${signature}`;
		localStorage.removeItem(key);

		const cached = await caches.open(key);
		const resp = await cached.match(`/${key}`);
		if (resp) {
			try {
				const jsonResponse = await resp.json();
				if (jsonResponse?.txns) {
					return <CacheStructure>jsonResponse;
				}
			} catch (e) {
				/**/
			}
		}
		return defaultRet;
	}

	static async loadTxns(appId: number, minRound: number, maxRound: number) {
		const LIMIT = 1000;
		let next: string | undefined;
		const txns: SwapTxn[] = [];

		do {
			let req = await indexerClient
				.searchForTransactions()
				.applicationID(appId);

			if (minRound) req = req.minRound(minRound);
			if (maxRound) req = req.maxRound(maxRound);

			if (LIMIT) req = req.limit(LIMIT);
			if (next) req = req.nextToken(next);

			const resp = await req.do();

			if (resp['transactions'] instanceof Array) {
				const batch: SwapTxn[] = resp['transactions'];
				const filteredTxns = batch
					// no duplicate txns
					.filter((txn) => !txns.find((cTxn) => cTxn.id === txn.id));
				txns.push(...filteredTxns);
			}

			next = resp['next-token'];
			if ((LIMIT && resp['transactions'].length < LIMIT)) {
				next = undefined;
			}
		} while (next);

		return txns;
	}

	static parseEvents(txns: SwapTxn[], events: string[]) {
		const resp: Record<string, any[]> = {};
		for (const event of events) {
			const selector = sha512_256(event).slice(0, 8);
			resp[event] = txns.map((txn) => {
				const logs = (txn.logs ?? []).map((log) => Buffer.from(log, 'base64').toString('hex'));
				const filteredLogs = logs.filter((log) => log.startsWith(selector));
				if (filteredLogs.length) {
					try {
						const events = filteredLogs.map((log) => {
							const argsAbiType = algosdk.ABITupleType.from(event.replace(/^\w+/, ''));
							// console.log('decoded', argsAbiType.decode(Uint8Array.from(Buffer.from(log.slice(8), 'hex'))));
							try {
								return argsAbiType.decode(Uint8Array.from(Buffer.from(log.slice(8), 'hex')));
							} catch (e) {
								console.log(log);
								throw e;
							}
						});
						return { ...txn, events: { [event]: events } };
					} catch (error) {
						console.error((<Error>error).message);
					}
					return { ...txn, events: <Record<string, algosdk.ABIValue[]>>{} };
				}
				return null;
			}).filter(Boolean);
		}
		return resp;
	}


	static async loadTxnsByEvent(appId: number, event: string) {
		const selector = sha512_256(event).slice(0, 8);
		const cache = await SwapEvents.getCache(appId, selector);
		const LIMIT = 1000;
		let next: string | undefined;

		do {
			let req = await indexerClient
				.searchForTransactions()
				.applicationID(appId)
				.minRound(cache.lastRound + 1);

			if (LIMIT) req = req.limit(LIMIT);
			if (next) req = req.nextToken(next);

			const resp = await req.do();

			if (resp['transactions'] instanceof Array) {
				const batch: SwapTxn[] = resp['transactions'];
				const filteredTxns = batch
					.filter((txn) => !cache.txns.find((cTxn) => cTxn.id === txn.id))
					.filter(
						(txn) =>
							txn.logs?.length &&
							txn.logs.find((log) => Buffer.from(log, 'base64').toString('hex').startsWith(selector))
					);
				cache.txns.push(...filteredTxns);
			}

			next = resp['next-token'];
			if ((LIMIT && resp['transactions'].length < LIMIT)) {
				next = undefined;
			}
		} while (next);
		for (const txn of cache.txns) {
			if (typeof txn['confirmed-round'] === 'number') {
				cache.lastRound = Math.max(cache.lastRound, txn['confirmed-round']);
			}
		}

		cache.txns = cache.txns.filter((txn, i) => !cache.txns.find((cTxn, index) => cTxn.id === txn.id && i !== index));

		await SwapEvents.setCache(cache, appId, selector);

		return cache.txns.map((txn) => {
			const logs = (txn.logs ?? []).map((log) => Buffer.from(log, 'base64').toString('hex'));
			const filteredLogs = logs.filter((log) => log.startsWith(selector));
			try {
				const events = filteredLogs.map((log) => {
					const argsAbiType = algosdk.ABITupleType.from(event.replace(/^\w+/, ''));
					// console.log('decoded', argsAbiType.decode(Uint8Array.from(Buffer.from(log.slice(8), 'hex'))));
					try {
						return argsAbiType.decode(Uint8Array.from(Buffer.from(log.slice(8), 'hex')));
					} catch (e) {
						console.log(log);
						throw e;
					}
				});
				return { ...txn, events: { [event]: events } };
			} catch (error) {
				console.error((<Error>error).message);
			}
			return { ...txn, events: <Record<string, algosdk.ABIValue[]>>{} };
		});
	}
}


export async function getSwapEvents(poolId: number) {
	const eventSignature = 'Swap(address,(uint256,uint256),(uint256,uint256),(uint256,uint256))';
	const updatedEvents: {
		sender: string;
		fromAmount: number;
		toAmount: number;
		direction: number;
		poolBals: [bigint, bigint];
		txn: SwapTxn;
	}[] = [];
	const txns = await SwapEvents.loadTxnsByEvent(poolId, eventSignature);
	for (const txn of txns) {
		const events = txn.events[eventSignature];
		if (events instanceof Array) {
			for (const event of events) {
				const [sender, inAmts, outAmts, poolBals] = <any[]>event;
				const direction = Number(inAmts[0]) === 0 ? 1 : 0;
				const fromAmount = inAmts[direction];
				const toAmount = outAmts[direction ? 0 : 1];
				updatedEvents.push({
					sender: sender,
					fromAmount: Number(fromAmount),
					toAmount: Number(toAmount),
					direction: direction,
					poolBals: poolBals,
					txn: txn,
				});
			}
		}
	}
	return updatedEvents;
}

export async function getDepositEvents(poolId: number) {
	const updatedEvents: {
		sender: string;
		amts: [bigint, bigint];
		lpt: bigint;
		adding: boolean;
		poolBals: [bigint, bigint];
		txn: SwapTxn;
	}[] = [];
	for (const eventSignature of [
		'Deposit(address,(uint256,uint256),uint256,(uint256,uint256))',
		'Withdraw(address,uint256,(uint256,uint256),(uint256,uint256))',
	]) {
		const txns = await SwapEvents.loadTxnsByEvent(poolId, eventSignature);
		for (const txn of txns) {
			const events = txn.events[eventSignature];
			if (events instanceof Array) {
				for (const event of events) {
					if (eventSignature.startsWith('Deposit')) {
						const [sender, inAmts, outLpt, poolBals] = <any[]>event;
						updatedEvents.push({
							sender: sender,
							amts: inAmts,
							lpt: outLpt,
							adding: true,
							poolBals: poolBals,
							txn: txn,
						});
					} else {
						const [sender, inLpt, outAmts, poolBals] = <any[]>event;
						updatedEvents.push({
							sender: sender,
							amts: outAmts,
							lpt: inLpt,
							adding: false,
							poolBals: poolBals,
							txn: txn,
						});
					}
				}
			}
		}
	}
	return updatedEvents;
}