/* global $, Handlebars */
/* exported triggerImport, loadTestArticle */

'use strict';

var updateFrequency = 1000;

function updateArticle(mode) {
	$.ajax({
		dataType: 'json',
		url: window.location.pathname + '/get',
		success: function(article) {
			updateStatus(article);
			checkStatus(article, mode);
		},
		error: function(jqXHR, status, error) {
			console.error(jqXHR.responseText);
			setTimeout(updateArticle.bind(null, mode), updateFrequency);
		}
	});
}

function checkStatus(article, mode) {
	var status, lastImportId;
	try {
		status = article.fbRecords[mode].imports[0].status || article.fbRecords[mode].most_recent_import_status.status;
	} catch (e) {}

	if (status !== 'SUCCESS' && status !== 'FAILED') {
		setTimeout(updateArticle.bind(null, mode), updateFrequency);
	}
}

function submitForm() {
	$('.js-url-error').text('');
	$('.article-status-container').html('');
	$('.js-url-group').removeClass('o-forms--error');
	$('.error-card').remove();

	var val = $('#url').val();
	if (!val) {
		return handleFormError('Please enter a UUID or article link to process');
	}

	var url = encodeURIComponent(val);
	if (window.location.pathname !== '/' + url) {
		window.history.pushState({}, '', '/article/' + url);
	}

	$('.js-url-submission-button').attr('disabled', 'disabled').text('Processing').addClass('activity');

	$.ajax({
		type: 'POST',
		dataType: 'json',
		url: '/article/' + url + '/get',
		success: function(article) {
			var url = encodeURIComponent(article.canonical);
			if (window.location.pathname !== '/' + url) {
				window.history.pushState({}, '', '/article/' + url);
			}

			restoreForm();
			updateStatus(article);
		},
		error: function(jqXHR, status, error) {
			handleFormError('Server returned error: ' + jqXHR.responseText);
		}
	});
}

function updateStatus(article) {
	$('.article-status-container').html(Handlebars.partials['article-status'](article));
}

function handleFormError(error) {
	restoreForm();
	$('.js-url-error').html(error);
	$('.js-url-group').addClass('o-forms--error');
}

function restoreForm() {
	$('.js-url-submission-button').removeAttr('disabled').text('Process').removeClass('activity');
}

function triggerImport(mode, type) {
	updateStatusIcon('.' + mode + '-' + type + '-status i', 'fa-spinner fa-spin');
	setButtonState('.' + mode + '-status-card .actions button', false);
	$('.error-card').remove();

	$.ajax({
		type: 'POST',
		url: '/article/' + encodeURIComponent($('.article-status-card').attr('data-canonical')) + '/' + mode + '/' + type,
		success: function(article) {
			updateStatus(article);
			checkStatus(article, mode);
		},
		error: function(jqXHR, status, error) {
			updateStatusIcon('.' + mode + '-' + type + '-status i', 'fa-times');
			setButtonState('.' + mode + '-status-card .actions button', true);
			$('.' + mode + '-publish-status-text').html(jqXHR.responseJSON.error);
			$('.' + mode + '-status-card').after(Handlebars.partials['error-card'](jqXHR.responseJSON));
		}
	});

	return false;
}

function update() {
	updateStatusIcon('.update-status i', 'fa-spinner fa-spin');
	setButtonState('.article-status-card .actions button', false);
	$('.error-card').remove();

	$.ajax({
		type: 'POST',
		url: '/article/' + encodeURIComponent($('.article-status-card').attr('data-canonical')) + '/update',
		success: function(article) {
			updateStatus(article);
		},
		error: function(jqXHR, status, error) {
			updateStatusIcon('.update-status i', 'fa-times');
			setButtonState('.article-status-card .actions button', true);
			$('.article-status-card').after(Handlebars.partials['error-card'](jqXHR.responseJSON));
		}
	});

	return false;
}

function reingest() {
	updateStatusIcon('.reingest-status i', 'fa-spinner fa-spin');
	setButtonState('.article-status-card .actions button', false);
	$('.error-card').remove();

	$.ajax({
		type: 'POST',
		url: '/article/' + $('.article-status-card').attr('data-uuid') + '/updateEs',
		success: function(article) {
			updateStatus(article);
		},
		error: function(jqXHR, status, error) {
			updateStatusIcon('.reingest-status i', 'fa-times');
			setButtonState('.article-status-card .actions button', true);
			$('.article-status-card').after(Handlebars.partials['error-card'](jqXHR.responseJSON));
		}
	});

	return false;
}

function loadTestArticle(url) {
	$('#url').val(url);
	submitForm();
}

function updateStatusIcon(selector, iconName) {
	$(selector).removeClass().addClass('fa ' + iconName);
}

function setButtonState(selector, enabled) {
	$(selector).each(function() {
		if (enabled) {
			$(this).removeAttr('disabled');
		} else {
			$(this).attr('disabled', 'disabled');
		}
	});
}
