$(function() {
	const $statusText = $("#status");

	$("#openOptions").on("click",function() {
		if(chrome.runtime.openOptionsPage) {
			chrome.runtime.openOptionsPage();
		} else {
			window.open(chrome.runtime.getURL("options.html"));
		}
	});

	chrome.storage.local.get(["blockStatus"],function(result) {
		const status = result.blockStatus;
		if(status === "server") {
			$statusText.text(chrome.i18n.getMessage("statusServer"));
		} else if(status === "local") {
			$statusText.text(chrome.i18n.getMessage("statusLocal"));
		} else if(status === "default") {
			$statusText.text(chrome.i18n.getMessage("statusDefault"));
		} else {
			$statusText.text(chrome.i18n.getMessage("statusError"));
		}
	});
});