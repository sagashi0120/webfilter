$(function() {
	const $blockListInput = $("#blockListInput");
	const $blockUrlInput = $("#blockUrlInput");
	const $sendUrlInput = $("#sendUrlInput");
	const $statusDiv = $("#status");

	$("#saveButton").on("click",saveSettings);
	$("#reloadButton").on("click",reloadSettings);
	$(window).on("hashchange",rootChange);

	loadSettings();
	rootChange();

	function reloadSettings() {
		chrome.runtime.sendMessage({ type: "reload" },function(response) {
			if(response && response.status === "ok") {
				loadSettings();
			}
		});
	}

	function saveSettings() {
		const blockListText = $blockListInput.val();
		const blockUrlText = $blockUrlInput.val();
		const sendUrlText = $sendUrlInput.val();

		setTimeout(() => {
			$statusDiv.text("").removeClass();
		},5000);

		chrome.storage.local.set({ sendServer: sendUrlText });

		if(blockUrlText.trim() !== "") {
			chrome.storage.local.set({ blockListServerUrl: blockUrlText },function() {
				$statusDiv.text(chrome.i18n.getMessage("saveDesc")).attr("class", "alert success");
				chrome.runtime.sendMessage({
					type: "updateServerUrl",
					serverUrl: blockUrlText
				});
			});
		} else {
			const newBlockList = [];
			const lines = blockListText.split("\n").map(item => item.trim()).filter(item => item.length > 0);

			for(const item of lines) {
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
					} catch (e) {
						$statusDiv.text(chrome.i18n.getMessage("urlError"))
								.attr("class", "alert danger");
						return;
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

			chrome.storage.local.set({ blockList: newBlockList },function() {
				$statusDiv.text(chrome.i18n.getMessage("saveDesc")).attr("class", "alert success");
				console.log("new block list:", newBlockList);
				chrome.runtime.sendMessage({
					type: "updateBlockList",
					blockList: newBlockList
				});
			});
			chrome.storage.local.set({ blockListServerUrl: blockUrlText });
		}
	}

	function loadSettings() {
		chrome.storage.local.get(["blockList"],function(result) {
			if(result.blockList) {
				const decodedList = result.blockList.map(item => {
				if(/^https?:\/\//i.test(item)) {
					try {
						const url = new URL(item);
						if(url.hostname.startsWith("xn--")) {
							return punycode.toUnicode(item);
						}
						return item;
					} catch(e) {
						if(item.includes("%")) {
							return decodeURIComponent(item);
						}
						return item;
					}
				} else {
					try {
						const url = new URL(`http://${item}`);
						if(url.hostname.startsWith("xn--")) {
							return punycode.toUnicode(item);
						}
						return item;
					} catch(e) {
						if(item.includes("%")) {
							return decodeURIComponent(item);
						}
						return item;
					}
				}
				});
				$blockListInput.val(decodedList.join("\n"));
			} else {
				$blockListInput.val("example.com\nmalicious-site.net");
			}
		});

		chrome.storage.local.get(["blockListServerUrl"],function(result) {
			if(result.blockListServerUrl) {
				$blockUrlInput.val(result.blockListServerUrl);
			}
		});

		chrome.storage.local.get(["sendServer"],function(result) {
			if(result.sendServer) {
				$sendUrlInput.val(result.sendServer);
			}
		});
	}

	function rootChange() {
		const hash = location.hash.slice(1);
		const target = hash || "settings";
		$(".root").hide();
		$(`.root.${target}`).show();
	}
});
