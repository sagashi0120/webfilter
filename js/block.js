$(function() {
	chrome.storage.local.get(["blockInfo"],function(result) {
		const blockInfo = result.blockInfo;
		if(!blockInfo || !blockInfo.request) return;

		const blockType = chrome.i18n.getMessage(`type_${blockInfo.request.type}`);
		const latestBlockedUrl = blockInfo.request.url;

		const $blockedUrlElement = $("#blocked-url");
		const $blockedText = $("#blockedText");

		if(latestBlockedUrl) {
			$blockedText.text(chrome.i18n.getMessage("blockedText",[blockType]));
			$blockedUrlElement.text(latestBlockedUrl).attr("href",latestBlockedUrl);
		}
	});
});