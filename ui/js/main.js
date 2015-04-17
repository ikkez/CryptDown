$(function(){
	var JsonFormatter = {
		stringify: function(cipherParams){
			// create json object with ciphertext
			var jsonObj = {
				ct: cipherParams.ciphertext.toString(CryptoJS.enc.Base64)
			};
			// optionally add iv and salt
			if (cipherParams.iv) {
				jsonObj.iv = cipherParams.iv.toString();
			}
			if (cipherParams.salt) {
				jsonObj.s = cipherParams.salt.toString();
			}
			// stringify json object
			return JSON.stringify(jsonObj);
		},

		//parse: function (jsonStr) {
		parse: function(jsonStr){
			// parse json string
			var jsonObj = JSON.parse(jsonStr);
			// extract ciphertext from json object, and create cipher params object
			var cipherParams = CryptoJS.lib.CipherParams.create({
				ciphertext: CryptoJS.enc.Base64.parse(jsonObj.ct)
			});
			// optionally extract iv and salt
			if (jsonObj.iv) {
				cipherParams.iv = CryptoJS.enc.Hex.parse(jsonObj.iv)
			}
			if (jsonObj.s) {
				cipherParams.salt = CryptoJS.enc.Hex.parse(jsonObj.s)
			}
			return cipherParams;
		}
	};

	$('#composeTabs a').click(function(e){
		e.preventDefault();
		$(this).tab('show')
	});

	var passInput,pass,textarea,cryptcase,pwbox,mdview,rawText,crypted,renderMD,cryptText,
		cryptedString,cryptedObj,ccache,converter,editor,pasteAsNewBtn,savePw;

	var init = function(){
		passInput = $('#pass');
		pass = passInput.val();
		textarea = $('#cryptdown');
		cryptcase = $('#encryped');
		pwbox = $('#pwbox');
		mdview = $('#mdview');
		pasteAsNewBtn = $('#pasteAsNew');
		rawText = '';
		crypted = false;
		savePw = false;
		renderMD = true;
		cryptText = '';
		cryptedString = '';
		cryptedObj = '';
		ccache = '';
		converter = new Showdown.converter();
		editor = new MediumEditor('#mdview.editable', {
			buttons: ['bold', 'italic', 'underline', 'anchor', 'header1', 'header2',
				'unorderedlist', 'orderedlist', 'pre', 'quote'],
			firstHeader: 'h1',
			secondHeader: 'h2'
		});
		mdview.on('input', function(){
			updateMarkdown($(this).html());
		});
		textarea.bind('input', function(){
			updateHtml(this.value);
		});
		passInput.on('input', function(){
			pass = passInput.val();
			if (crypted) {
				if (passInput.val() != '') {
					decrypt();
				} else {
					updateHtml(cryptText);
					mdview.toggleClass('crypted',true);
				}
			} else {
				if (passInput.val() != '') {
					encrypt();
					mdview.toggleClass('crypted',true);
				} else {
					textarea.val(rawText);
					updateHtml(rawText);
					mdview.toggleClass('crypted',false);
				}
			}
		});
		$('#randomPassword').on('change', function(e){
			if ($(this).prop('checked')) {
				passInput.prop('type', 'text');
				passInput.val(generatePassword);
			} else {
				passInput.prop('type', 'password');
				passInput.val('');
			}
			passInput.trigger('input');
		});
		$('#composeForm').on('submit', function(e){
			if (passInput.val() == '') {
				e.preventDefault();
				alert('Set a password for encryption.');
				return false;
			} else {
				$('#saveBtn i').attr('class', 'fa fa-spinner fa-pulse');
				$.ajax({
					type: 'POST',
					data: $('#composeForm').serialize(),
					dataType: 'JSON',
					url: 'create'
				}).done(function(data){
					if (savePw) {
						window.localStorage[data.pasteID] = pass;
					}
					window.location.href = data.pasteURI;
				}).fail(function(jqXHR, textStatus){
					alert(jqXHR.responseJSON.text);
					$('#saveBtn i').attr('class', 'fa fa-save fa-fw');
				});
				e.preventDefault();
				return false;
			}
		});

		$('#savePw').on('click', function () {
			var el = $(this);
			if (savePw) {
				savePw = false;
				el.attr('class','btn btn-default');
			} else {
				savePw = true;
				el.attr('class','btn btn-success');
			}
		});

		// init
		if (cryptcase.hasClass('source')) {
			crypted = true;
			cryptedString = cryptcase.val();
			cryptedObj = JSON.parse(cryptedString.substring(64));
			cryptText = cryptedObj.ct;
			mdview.toggleClass('crypted',true);
			updateHtml(cryptText);
			var localPass = window.localStorage[mdview.attr('data-pasteID')] || false;
			if (localPass) {
				passInput.val(localPass).trigger('input');
				$('#decryptPassLabel').html('Decryption password was found on this device. <a href="#" id="forgetPw">Forget it.</a>');
				$('#forgetPw').on('click',function(e){
					e.preventDefault();
					delete window.localStorage[mdview.attr('data-pasteID')];
					$('#decryptPassLabel').text('Decryption password');
					return false;
				});
			}
		} else {
			updateHtml(textarea.val());
		}

		$('[data-toggle="tooltip"]').tooltip();

	};

	var encrypt = function(){
		var encrypted = CryptoJS.AES.encrypt(rawText, pass, {format: JsonFormatter});
		var hmac = CryptoJS.HmacSHA256(encrypted.toString(), CryptoJS.SHA256(pass)).toString();
		var transitmessage = hmac + encrypted;
		cryptcase.val(transitmessage);
		var cryptText = JSON.parse(encrypted).ct;
		textarea.val(cryptText);
		updateHtml(cryptText);
	};

	var decrypt = function(){
		var transithmac = cryptedString.substring(0, 64);
		var transitencrypted = cryptedString.substring(64);
		var decryptedhmac = CryptoJS.HmacSHA256(transitencrypted, CryptoJS.SHA256(pass)).toString();
		var decrypted = CryptoJS.AES.decrypt(transitencrypted, pass, {format: JsonFormatter});
		if (transithmac == decryptedhmac) {
			// correct
			updateHtml(decrypted.toString(CryptoJS.enc.Utf8));
			pwbox.toggleClass('has-error', false);
			pwbox.toggleClass('has-success', true);
			mdview.toggleClass('crypted',false);
			pasteAsNewBtn.prop('disabled',false);
		} else {
			// wrong
			updateHtml(decrypted.toString());
			pwbox.toggleClass('has-error', true);
			pwbox.toggleClass('has-success', false);
			mdview.toggleClass('crypted',true);
			pasteAsNewBtn.prop('disabled',true);
		}
	};

	var markdownize = function(content){
		var html = content.split("\n").map($.trim).filter(function(line){
			return line != "";
		}).join("\n");
		return toMarkdown(html);
	};

	// Method that converts the HTML contents to Markdown
	var updateMarkdown = function(content){
		var markdown = markdownize(content);
		if (textarea.val() == markdown)
			return;
		textarea.val(markdown);
		updateRawText();
	};
	var sanitize = function (text) {
		return text.replace(/<\s*\/\s*script.*>/i,'&lt;/script&gt;').replace(/<\s*script.*>/i,'&lt;script&gt;');
	};
	var updateHtml = function(content){
		ccache = content;
		if (renderMD) {
			if (markdownize(mdview.html()) == content)
				return;
			mdview.html(sanitize(converter.makeHtml(content)));
			updateRawText();
		} else
			mdview.html('<pre class="md-view"><code>' + sanitize(content) + '</code></pre>');
	};
	var updateRawText = function(){
		if (passInput.val() == '')
			rawText = textarea.val();
	};

	var generatePassword = function(){
		var length = 10,
			charset = "abcdefghijklnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
			retVal = "";
		for (var i = 0, n = charset.length; i < length; ++i) {
			retVal += charset.charAt(Math.floor(Math.random() * n));
		}
		return retVal;
	};

	$('#pass-reset').on('click', function(){
		passInput.val('');
		passInput.trigger('input');
		pwbox.toggleClass('has-error', true);
		pwbox.toggleClass('has-success', false);
		pasteAsNewBtn.prop('disabled', true);
	});

	$('input[name="render"]').on('change', function(e){
		if ($(this).prop('id') == 'renderText') {
			renderMD = true;
		}
		else if ($(this).prop('id') == 'renderSource') {
			renderMD = false;
		}
		passInput.trigger('input');
	});

	$('#infocopytext').append(' - mail' + '@' + 'cryptdown' + '.' + 'eu');

	$('#pasteAsNew').on('click', function() {
		var raw = ccache;
		var main = $('#main');
		main.fadeOut();
		main.load($('base').attr('href')+ ' #main',function(response,status,xhr){
			init();
			setTimeout(function(){
				$('#cryptdown').text(raw);
				updateHtml(raw);
				main.fadeIn();
			},500);
		});
	});

	init();
});

