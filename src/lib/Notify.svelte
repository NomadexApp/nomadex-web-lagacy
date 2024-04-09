<script lang="ts" context="module">
	import { writable } from 'svelte/store';
	type Notification = {
		id: number;
		message: string;
		type: 'info' | 'error' | 'warn' | 'pending' | 'success';
		remove: () => void;
	};
	type NotificationInternals = {};
	let notifications = writable<(Notification & NotificationInternals)[]>([]);

	export function addNotification(type: Notification['type'], message: string, timeoutMs?: number) {
		const notification = {
			id: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
			type,
			message,
			remove() {},
		};

		let timeout: NodeJS.Timeout;
		if (typeof timeoutMs === 'number') {
			timeout = setTimeout(() => {
				notification.remove();
			}, timeoutMs);
		}

		notification.remove = () => {
			clearTimeout(timeout);
			notifications.update((ns) => ns.filter((not) => not.id !== notification.id));
		};

		notifications.update((nts) => {
			nts.push(notification);
			return nts;
		});

		return notification.remove;
	}

	// setInterval(() => {
	// 	if (Math.random() > 0.5) {
	// 		switch (Math.floor(Math.random() * 5)) {
	// 			case 0:
	// 				addNotification('info', 'Hello World', Math.random() * 30000);
	// 				break;
	// 			case 1:
	// 				addNotification('warn', 'Hello World', Math.random() * 30000);
	// 				break;
	// 			case 2:
	// 				addNotification('error', 'Lorem ipsum dolor sit amet.', Math.random() * 30000);
	// 				break;
	// 			case 3:
	// 				addNotification(
	// 					'success',
	// 					'Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor!',
	// 					Math.random() * 30000
	// 				);
	// 				break;

	// 			case 4:
	// 				addNotification('pending', 'Hello World', Math.random() * 30000);
	// 				break;
	// 		}
	// 	}
	// }, 500);

	// addNotification('info', 'Hello World');
	// addNotification(
	// 	'info',
	// 	'Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor! Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor!   Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor!'
	// );
	// addNotification('warn', 'Hello World');
	// addNotification(
	// 	'warn',
	// 	'Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor! Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor!   Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor!'
	// );
	// addNotification('error', 'Lorem ipsum dolor sit amet.');
	// addNotification(
	// 	'error',
	// 	'Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor! Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor!   Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor!'
	// );
	// addNotification('success', 'Lorem ipsum dolor');
	// addNotification(
	// 	'success',
	// 	'Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor! Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor!   Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor!'
	// );
	// addNotification('pending', 'Hello World');
	// addNotification(
	// 	'pending',
	// 	'Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor! Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor!   Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor!'
	// );
</script>

<script lang="ts">
	import InfoIcon from 'svelte-star/dist/md/MdInfo.svelte';
	import WarnIcon from 'svelte-star/dist/md/MdWarning.svelte';
	import ErrorIcon from 'svelte-star/dist/md/MdError.svelte';
	import SuccessIcon from 'svelte-star/dist/md/MdCheckCircle.svelte';
	import MdCloseIcon from 'svelte-star/dist/md/MdClose.svelte';
</script>

{#if $notifications.length}
	<div
		class="fixed z-[2000] left-[50%] translate-x-[-50%] top-[10px] min-w-[250px] min-h-[40px] rounded-btn flex flex-col gap-4 items-end"
	>
		{#each $notifications as notification}
			<div class="notification relative bg-primary rounded-btn p-2 text-wrap max-w-[250px] {notification.type}">
				<div class="icon">
					<span>
						{#if notification.type === 'info'}
							<InfoIcon />
						{:else if notification.type === 'warn'}
							<WarnIcon />
						{:else if notification.type === 'error'}
							<ErrorIcon />
						{:else if notification.type === 'pending'}
							<span class="loading w-5 ml-[0.17rem] mt-[0.17rem]" />
						{:else if notification.type === 'success'}
							<SuccessIcon />
						{/if}
					</span>
				</div>
				<div class="message">
					{notification.message.slice(0, 100)}{notification.message.length > 100 ? '...' : ''}
				</div>
				<div class="icon close">
					<button on:click={() => notification.remove()}>
						<MdCloseIcon />
					</button>
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	@keyframes fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.notification {
		animation: fade 1s forwards;
		background: var(--notification-bg);
		padding: 2rem;
		min-width: 270px;
		padding: 0.75rem;
		display: flex;
		gap: 0.5rem;
		box-shadow: 0 0 3px #666633;
	}
	.notification > .icon.close {
		background: transparent;
		display: flex;
		align-items: start;
	}
	.notification > .icon {
		color: var(--notification-color);
		border-radius: 4rem;
		display: flex;
		justify-content: center;
		align-items: center;
	}
	.icon > * {
		display: flex;
		width: 2rem;
		height: 2rem;
	}
	.icon.close {
		--notification-color: #fff;
	}
	.notification .message {
		flex-grow: 1;
		width: 100%;
		display: flex;
		justify-content: start;
		align-items: center;
		color: #fff;
	}
	.notification.info {
		--notification-bg: #222211;
		--notification-color: #6666ff;
		color: black;
	}
	.notification.error {
		--notification-bg: #222211;
		--notification-color: #ff6666;
		color: black;
	}
	.notification.warn {
		--notification-bg: #222211;
		--notification-color: #f3c04a;
		color: black;
	}
	.notification.pending {
		--notification-bg: #222211;
		--notification-color: #ffff66;
		color: black;
	}
	.notification.success {
		--notification-bg: #222211;
		--notification-color: #77cc77;
		color: black;
	}
</style>
