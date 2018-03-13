<?php
/**
 *  CryptDown
 *
 *  The contents of this file are subject to the terms of the GNU General
 *  Public License Version 3.0. You may not use this file except in
 *  compliance with the license. Any of the license terms and conditions
 *  can be waived if you get permission from the copyright holder.
 *
 *  Copyright (c) 2015 by ikkez
 *  Christian Knuth <mail@cryptdown.eu>
 *  https://github.com/ikkez/CryptDown/
 *
 *  @version 1.1.0
 *  @date 18.03.2015
 **/

/** @var Base $f3 */
$f3 = include('lib/base.php');
$f3->config('config.ini');

if ($f3->exists('LEGACY_ROUTING', $legacy)) {
	if ($legacy && $f3->exists('GET.r',$route)) {
		$f3->set('SERVER.REQUEST_URI','/'.$route);
		$f3->set('PATH','/'.$route);
	}
} else
	$f3->set('LEGACY_ROUTING',false);

$f3->set('DB', new \DB\SQL('sqlite:data/pastes.db'));

// force SSL
if ($f3->get('FORCE_SSL') && $f3->get('SCHEME')=='http')
	$f3->reroute(str_replace('http','https',$f3->get('REALM')));

// home
$f3->route('GET /',function( \Base $f3 ) {
	$f3->set('sub_tmpl','index.html');
	echo \Template::instance()->render('layout.html');
});

// view paste
$f3->route('GET @view: /view/@uuid',function( \Base $f3, $params ) {
	$mapper = new \DB\SQL\Mapper($f3->get('DB'),$f3->get('db_table'));

	if ($f3->get('DELETE_ON_ACCESS'))
		$mapper->load(array('uuid = ?',$params['uuid']));
	else
		// don't load deleted
		$mapper->load(array('uuid = ? and lifetime > ?',$params['uuid'], date('Y-m-d H:i:s')));

	if ($mapper->dry())
		$f3->error(404,'This document does not exist.');

	// delete on access
	if ($f3->get('DELETE_ON_ACCESS') && strtotime($mapper->lifetime) <= time()) {
		$mapper->erase();
		$f3->error(404,'This document does not exist.');
	}

	$f3->set('paste',$mapper);
	$f3->set('sub_tmpl','view.html');
	echo \Template::instance()->render('layout.html');
});

// save new
$f3->route('POST /create',function( \Base $f3 ) {
	$mapper = new \DB\SQL\Mapper($f3->get('DB'),$f3->get('db_table'));

	if ($f3->get('AJAX'))
		header('Content-Type: application/json');

	// good things take a while
	sleep(1);

	if (!$f3->get('ENABLE_SAVE'))
		$f3->error('400','Saving new pastes is currently disabled');

	if (!$f3->devoid('POST.cryptdown')) {
		// set expiration
		$lifetime = $f3->get('POST.lifetime');
		if (!in_array($lifetime,array('1h','1d','1w','1m','1y')))
			$lifetime = '1w';
		if ($lifetime == '1h')
			$lifetime = date('Y-m-d H:i:s',strtotime('+1 hour'));
		elseif ($lifetime == '1d')
			$lifetime = date('Y-m-d H:i:s',strtotime('+1 day'));
		elseif ($lifetime == '1w')
			$lifetime = date('Y-m-d H:i:s',strtotime('+1 week'));
		elseif ($lifetime == '1m')
			$lifetime = date('Y-m-d H:i:s',strtotime('+1 month'));
		elseif ($lifetime == '1y')
			$lifetime = date('Y-m-d H:i:s',strtotime('+1 year'));

		// check max size
		$size = strlen($f3->get( 'POST.cryptdown' ));
		$max_size = $f3->get('max_paste_size')*1000;
		if ($size > $max_size)
			$f3->error(400,'Your document ('.$size/1000 .'kb) exceeds the maximum size of '.($max_size/1000).'kb');

		$mapper->data = $f3->get( 'POST.cryptdown' );
		$mapper->crdate = date('Y-m-d H:i:s');
		$mapper->lifetime = $lifetime;
		$mapper->uuid = $f3->hash( $f3->SALT . time() );
		$mapper->save();

		$path = $f3->LEGACY_ROUTING
				? '?r=view/'.$mapper->uuid
				: '/view/'.$mapper->uuid;

		if ($f3->get('AJAX')) {
			$f3->status(200);

			echo json_encode(array(
				'pasteURI' => $f3->SCHEME.'://'.$f3->HOST.$f3->BASE.$path,
				'pasteID' => $mapper->uuid,
			));
			exit();
		}
		$f3->reroute($path);

	} else {
		if ($f3->get('AJAX'))
			$f3->error(400,'No message body send');
		else
			$f3->reroute('/');
	}
});

// setup the database
$f3->route('GET /install',function( Base $f3, $params) {
	// preflight system check
	if (!is_dir($f3->get('TEMP')) || !is_writable($f3->get('TEMP')))
		$preErr[] = sprintf('please make sure that the \'%s\' directory is existing and writable.',$f3->get('TEMP'));
	if (!is_writable('data/'))
		$preErr[] = sprintf('please make sure that the \'%s\' directory is writable.','data/');

	if(isset($preErr))
		die(implode("\n",$preErr));

	$db = $f3->get('DB');
	$table = $f3->get('db_table');
	$schema = new \DB\SQL\Schema($db);
	if (!in_array($table, $schema->getTables())){
		$table = $schema->createTable( $table );
		$table->addColumn('data')->type_text();
		$table->addColumn('crdate')->type_datetime();
		$table->addColumn('lifetime')->type_datetime();
		$table->addColumn('uuid')->type_varchar( 30 )->index( true );
		$table->build();
		echo "installed";
	} else {
		echo "already installed";
	}
});

// stats and cleanup
$f3->route(array('GET @stats: /stats', 'GET @cleanup: /cleanup'),function( Base $f3, $params) {
	$mapper = new \DB\SQL\Mapper($f3->get('DB'),$f3->get('db_table'));

	if ($f3->get('ALIAS') == 'cleanup')
		$f3->set('cleanup', $mapper->erase(array('lifetime < ?',date('Y-m-d H:i:s'))));

	$f3->set('all', $mapper->count());
	$f3->set('old', $mapper->count(array('lifetime < ?',date('Y-m-d H:i:s'))));

	$f3->set('sub_tmpl','stats.html');
	echo \Template::instance()->render('layout.html');
});

// error handler
$f3->set('ONERROR',function( Base $f3){
	$error = $f3->get('ERROR');
	while (ob_get_level())
		ob_end_clean();
	if ($f3->get('AJAX')) {
		echo json_encode($error);
		exit;
	}
	$f3->set('sub_tmpl','error.html');
	echo \Template::instance()->render('layout.html');
});

// minify
/*$f3->route('GET /minified/app.js', function( Base $f3, $args) {
		$path = $f3->get('UI').'js/';
		$files = array(
			'vendor/bootstrap.min.js',
			'vendor/medium-editor.min.js',
			'vendor/Showdown.min.js',
			'vendor/to-markdown.js',
			'main.js'
		);
		echo Web::instance()->minify($files, null, true, $path);
	}, 3600 * 24
);*/

// kick start and cross the fingers
$f3->run();