const DEFAULT_BLOCK_LIST = [
	"example.com",
	"malicious-site.net",
	"bad-keyword-in-url"
];
const BLOCK_PAGE_BASE_URL = chrome.runtime.getURL("block.html");
let isUpdating = false;

async function removeAllDynamicRules() {
	const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
	const removeRuleIds = existingRules.map(rule => rule.id);
	if(removeRuleIds.length > 0) {
		await chrome.declarativeNetRequest.updateDynamicRules({
			removeRuleIds
		});
		console.log("declarativeNetRequest rules removed:",removeRuleIds);
	}
}

chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(async(info) => {
	console.log(info);
	const blockedUrl = info.request.url;
	const result = await chrome.storage.local.get(["blockedUrls","sendServer"]);
	const urls = result.blockedUrls || [];
	const serverUrl = result.sendServer;
	urls.unshift(blockedUrl);
	if(urls.length > 5) {
		urls.pop();
	}
	await chrome.storage.local.set({
		blockedUrls: urls,
		blockInfo: info
	});
	if(serverUrl) {
		try {
			await fetch(serverUrl,{
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					blockedUrl,
					timestamp: Date.now()
				})
			});
		} catch(err) {
			console.error("送信失敗:",err);
		}
	}
});

async function updateBlockRules(newBlockList) {
	if(isUpdating) {
		console.warn("skiped");
		return;
	}
	isUpdating = true;
	try {
		const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
		const removeRuleIds = existingRules.map(rule => rule.id);
		if(removeRuleIds.length > 0) {
			await chrome.declarativeNetRequest.updateDynamicRules({
				removeRuleIds
			});
			const afterRemove = await chrome.declarativeNetRequest.getDynamicRules();
			console.log("[delete] rules id:",afterRemove.map(r => r.id));
			if(afterRemove.length > 0) {
				throw new Error("rules remove failed.");
			}
		}
		const newRules = newBlockList.map((item,idx) => {
			let filter;
			if(/^https?:\/\//i.test(item)) {
				const url = new URL(item);
				filter = `||${url.hostname}^`;
			} else {
				filter = `*${item}*`;
			}

			return {
				id: 10000 + idx,
				priority: 1,
				action: {
					type: "redirect",
					redirect: {
						url: BLOCK_PAGE_BASE_URL
					}
				},
				condition: {
					urlFilter: filter,
					resourceTypes: [
						"main_frame",
						"sub_frame",
						"script",
						"image",
						"media",
						"websocket",
						"xmlhttprequest"
					]
				}
			};
		});
		await chrome.declarativeNetRequest.updateDynamicRules({
			addRules: [{
				id: 9999,
				priority: 1,
				action: {
					type: "redirect",
					redirect: {
						url: BLOCK_PAGE_BASE_URL
					}
				},
				condition: {
					urlFilter: "example.com/block-test",
					resourceTypes: [
						"main_frame",
						"sub_frame",
						"script",
						"image",
						"media",
						"websocket",
						"xmlhttprequest"
					]
				}
			}],
			removeRuleIds: [9999]
		});
		await chrome.declarativeNetRequest.updateDynamicRules({
			addRules: newRules
		});
		console.log("new rules add:",newRules.map(r => r.id));
	} catch(err) {
		console.error("update rules error:",err?.message || err);
	} finally {
		isUpdating = false;
	}
}

async function loadAndApplySettings() {
	try {
		const serverResult = await chrome.storage.local.get(["blockListServerUrl"]);
		const serverUrl = serverResult.blockListServerUrl;
		let loadedBlockList = [];
		const newBlockList = [];

		if(serverUrl) {
			try {
				const response = await fetch(serverUrl,{
					cache: "no-store"
				});
				if(!response.ok) {
					throw new Error("blockList get error");
				}
				const serverBlockList = await response.json();
				for(const item of serverBlockList) {
					if(/^https?:\/\//i.test(item)) {
						try {
							const url = new URL(item);
							const hostname = url.hostname;
							if(hostname.startsWith("xn--")) {
								newBlockList.push(url.hostname);
							} else if(hostname.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/)) {
								newBlockList.push(encodeURIComponent(item));
							} else {
								newBlockList.push(item);
							}
						} catch(e) {
							console.error("Invalid URL in serverBlockList:",item,e);
							continue;
						}
					} else {
						try {
							const url = new URL(`http://${item}`);
							const hostname = url.hostname;
							if(hostname.startsWith("xn--")) {
								newBlockList.push(url.hostname);
							} else if(hostname.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/)) {
								newBlockList.push(encodeURIComponent(item));
							} else {
								newBlockList.push(item);
							}
						} catch {
							newBlockList.push(item);
						}
					}
				}

				loadedBlockList = newBlockList;
				console.log("[server] loaded:",loadedBlockList);
				await chrome.storage.local.set({
					blockList: loadedBlockList
				});
				await chrome.storage.local.set({ blockStatus: "server" });
			} catch(err) {
				console.error("server error:",err);
				const result = await chrome.storage.local.get(["blockList"]);
				if(result.blockList && Array.isArray(result.blockList)) {
					loadedBlockList = result.blockList;
					console.log("[local] loaded:",loadedBlockList);
					await chrome.storage.local.set({ blockStatus: "local" });
				} else {
					loadedBlockList = DEFAULT_BLOCK_LIST;
					console.log("use default rules");
					await chrome.storage.local.set({
						blockList: loadedBlockList
					});
					await chrome.storage.local.set({ blockStatus: "default" });
				}
			}
		} else {
			const result = await chrome.storage.local.get(["blockList"]);
			if(result.blockList && Array.isArray(result.blockList)) {
				loadedBlockList = result.blockList;
				console.log("[local] loaded:",loadedBlockList);
				await chrome.storage.local.set({ blockStatus: "local" });
			} else {
				loadedBlockList = DEFAULT_BLOCK_LIST;
				console.log("use default rules");
				await chrome.storage.local.set({
					blockList: loadedBlockList
				});
				await chrome.storage.local.set({ blockStatus: "default" });
			}
		}
		await updateBlockRules(loadedBlockList);
	} catch (err) {
		console.error("設定ロード時にエラー:",err?.message || err);
	}
}

chrome.runtime.onInstalled.addListener(async() => {
	await loadAndApplySettings();
});

chrome.runtime.onMessage.addListener(async(message,sender,sendResponse) => {
	if(message.type === "updateBlockList") {
		chrome.storage.local.set({
			blockList: message.blockList
		},async() => {
			await updateBlockRules(message.blockList);
			sendResponse({
				status: "ok"
			});
		});
		return true;
	} else if(message.type === "updateServerUrl") {
		chrome.storage.local.set({ blockListServerUrl: message.serverUrl },async() => {
			await loadAndApplySettings();
			sendResponse({ status: "ok" });
		});
		return true;
	} else if(message.type === "updateSendServer") {
		chrome.storage.local.set({ sendServer: message.sendServer },async() => {
			await loadAndApplySettings();
			sendResponse({ status: "ok" });
		});
		return true;
	} else if(message.type === "reload") {
		await loadAndApplySettings();
		sendResponse({ status: "ok" });
		return true;
	}
});

console.log("Service Worket Start.");
setInterval(async() => {
	await loadAndApplySettings();
},1000 * 300);