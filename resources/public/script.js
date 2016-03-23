/* global $, Handlebars */
/* exported setPublishState, loadTestArticle */

'use strict';

var uuidRegex = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/;

function submitForm() {
	$('.js-uuid-error').text('');
	$('.article-status-container').html('');
	$('.js-uuid-group').removeClass('o-forms--error');
	$('.error-card').remove();

	var val = $('#uuid').val();
	if (!val) {
		return handleFormError('Please enter a UUID or article link to process');
	}
	var matches = val.match(uuidRegex);
	if (!matches) {
		return handleFormError('Please enter a valid UUID or an article link containing a UUID');
	}
	var uuid = matches[0];
	if (window.location.pathname !== '/' + uuid) {
		window.history.pushState({
			uuid: uuid
		}, '', '/' + uuid);
	}
	$('.js-uuid-submission-button').attr('disabled', 'disabled').text('Processing').addClass('activity');

	$.ajax({
		type: 'POST',
		dataType: 'json',
		url: '/' + uuid + '/get',
		success: function(article) {
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
	$('.js-uuid-error').html(error);
	$('.js-uuid-group').addClass('o-forms--error');
}

function restoreForm() {
	$('.js-uuid-submission-button').removeAttr('disabled').text('Process').removeClass('activity');
}

function setPublishState(feed, publish) {
	updateStatusIcon(feed, 'fa-spinner fa-spin');
	setButtonState(feed, false);
	$('.error-card').remove();

	if (publish) {
		$('.' + feed + '-publish-status-text').html('Publishing, please wait...');
	} else {
		$('.' + feed + '-publish-status-text').html('Removing, please wait...');
	}

	$.ajax({
		type: 'POST',
		url: '/' + $('.article-status-card').attr('data-uuid') + '/' + feed + '/' + (publish ? 'publish' : 'unpublish'),
		success: function(article) {
			updateStatus(article);
		},
		error: function(jqXHR, status, error) {
			updateStatusIcon(feed, 'fa-times');
			setButtonState(feed, true);
			$('.' + feed + '-publish-status-text').html(jqXHR.responseJSON.error);
			$('.' + feed + '-status-card').after(Handlebars.partials['error-card'](jqXHR.responseJSON));
		}
	});

	return false;
}

function loadTestArticle(uuid) {
	$('#uuid').val(uuid);
	submitForm();
}

function updateStatusIcon(feed, type, iconName) {
	$('.' + feed + '-' + type + '-status i').removeClass().addClass('fa ' + iconName);
}

function setButtonState(feed, enabled) {
	$('.' + feed + '-status-card .feed-actions button').each(function() {
		if (enabled) {
			$(this).removeAttr('disabled');
		} else {
			$(this).attr('disabled', 'disabled');
		}
	});
}
