/* global $ */

'use strict';

var uuidRegex = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/;

$(function() {
	if ($('#uuid').val()) {
		submitForm();
	} else {
		$('#uuid').focus();
	}
});

function submitForm() {
	$('.js-uuid-error').text('');
	$('.article-status-container').html('');
	$('.js-uuid-group').removeClass('o-forms--error');
	if (!$('#uuid').val()) {
		return handleFormError('Please enter a UUID or article link to process');
	}
	var uuid = $('#uuid').val().match(uuidRegex);
	if (!uuid) {
		return handleFormError('Please enter a valid UUID or an article link containing a UUID');
	}
	if (window.location.pathname !== '/' + uuid[0]) {
		window.history.pushState({}, '', '/' + uuid[0]);
	}
	$('.js-uuid-submission-button').attr('disabled', 'disabled').text('Processing').addClass('activity');

	$.ajax({
		type: 'POST',
		url: '/' + uuid[0],
		success: function(data) {
			restoreForm();
			$('.article-status-container').html(data);
			initialiseStatusCards();
		},
		error: function(jqXHR, status, error) {
			handleFormError('Server returned error: ' + jqXHR.responseText);
		}
	});
}

function handleFormError(error) {
	restoreForm();
	$('.js-uuid-error').html(error);
	$('.js-uuid-group').addClass('o-forms--error');
}

function restoreForm() {
	$('.js-uuid-submission-button').removeAttr('disabled').text('Process').removeClass('activity');
}

function initialiseStatusCards() {
	$('.status-card').each(function() {
		var channel = $(this).attr('data-channel');

		updateStatusCard(channel);
	});
}

function updateStatusCard(channel) {
	var card = $('.' + channel + '-status-card');
	var uploaded = card.attr('data-uploaded');

	if (uploaded) {
		$('.channel-actions', card).html('<button class="o-techdocs-card__actionbutton" onclick="deleteArticle(\'' + channel + '\');"><i class="fa fa-trash-o"></i> Delete</button><button class="o-techdocs-card__actionbutton" onclick="uploadArticle(\'' + channel + '\');"><i class="fa fa-arrow-circle-up"></i> Update</button>');
		updateStatusIcon(channel, 'fa-square');
	} else {
		$('.channel-actions', card).html('<button class="o-techdocs-card__actionbutton" onclick="uploadArticle(\'' + channel + '\');"><i class="fa fa-arrow-circle-up"></i> Upload</button>');
		updateStatusIcon(channel, 'fa-square-o');
	}
}

function deleteArticle(channel) {
	updateStatusIcon(channel, 'fa-spinner fa-spin');
	setButtonState(channel, false);
	$('.' + channel + '-status-text').html('Deleting, please wait...');

	$.ajax({
		type: 'POST',
		url: '/delete/' + channel + '/' + $('.article-status-card').attr('data-uuid'),
		success: function(data) {
			updateStatusIcon(channel, 'fa-check');
			$('.' + channel + '-status-text').html(data);
			$('.' + channel + '-status-card').attr('data-uploaded', '');
			setTimeout(function() { updateStatusCard(channel); }, 1000);
		},
		error: function(jqXHR, status, error) {
			updateStatusIcon(channel, 'fa-times');
			setButtonState(channel, true);
			$('.' + channel + '-status-text').html('Server returned error: ' + jqXHR.responseText);
		}
	});

	return false;
}

function localArticleAction(link, action) {
	if ($(link).attr('data-inprogress')) {
		return;
	}
	var originalContents = $(link).html();

	$(link).attr('data-inprogress', 1).html('<i class="fa fa-spinner fa-spin" /> Previewing...');

	$.ajax({
		type: 'POST',
		url: '/' + action + '/' + $('.article-status-card').attr('data-uuid'),
		success: function() {
			$(link).removeAttr('data-inprogress').html(originalContents);
		},
		error: function(jqXHR, status, error) {
			$(link).removeAttr('data-inprogress').html(originalContents);
			alert('Could not open preview: ' + jqXHR.responseText);
		}
	});
}

function uploadArticle(channel) {
	var sections = $('.' + channel + '-status-card select').val();

	if (!sections) {
		alert("Please select at least one channel to upload to.");
		return;
	}

	updateStatusIcon(channel, 'fa-spinner fa-spin');
	setButtonState(channel, false);
	$('.' + channel + '-status-text').html('Uploading, please wait...');

	$.ajax({
		type: 'POST',
		url: '/post/' + channel + '/' + $('.article-status-card').attr('data-uuid'),
		data: { sections: sections },
		success: function(data) {
			updateStatusIcon(channel, 'fa-check');
			$('.' + channel + '-status-text').html(data);
			$('.' + channel + '-status-card').attr('data-uploaded', '1');
			setTimeout(function() { updateStatusCard(channel); }, 1000);
		},
		error: function(jqXHR, status, error) {
			updateStatusIcon(channel, 'fa-times');
			setButtonState(channel, true);
			$('.' + channel + '-status-text').html('Server returned error: ' + jqXHR.responseText);
		}
	});

	return false;
}

function loadTestArticle(uuid) {
	$('#uuid').val(uuid);
	submitForm();
}

function updateStatusIcon(channel, iconName) {
	$('.' + channel + '-status i').removeClass().addClass('fa ' + iconName);
}

function setButtonState(channel, enabled) {
	$('.' + channel + '-status-card .channel-actions button').each(function() {
		if (enabled) {
			$(this).removeAttr('disabled');
		} else {
			$(this).attr('disabled', 'disabled');
		}
	});
}
