CryptDown
=======

CryptDown is a microservice to store documents, pastes or code snippets, similar to pastebin.

It uses real 256bit AES encryption, which takes place directly in your browser. No plaintext is ever being sent. Nobody can help you when you lose an encryption password for a paste. Your IP-Address will not be saved!

The 1st CryptDown instance can be found on [cryptdown.eu](https://cryptdown.eu). Feel free to improve this tool, give feedback, or create a new self-hosted instance.

CryptDown was built with the following great and free software:

* [Fat-Free Framework](https://github.com/bcosca/fatfree)
* CryptoJS
* MediumEditor
* Showdown.js
* to-markdown.js
* jQuery
* Twitter Bootstrap
* font-awesome

#### Installation

To install CryptDown on your own, ensure you have the following environment:

* apache webserver (nginx is also possible)
* PHP 5.3
* PDO SQlite

ajdust the `config.ini` file for your needs and run the `/install` route in your browser. done.

#### Security

This tool is just for testing purpose and a personal playground. Don't blame me if you lose your data, keys, or think it lacks on security.

Please file an issue for support and improvements.

#### License

Copyright (C) 2015, Christian Knuth

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
