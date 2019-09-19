'use strict';
/**
 * `file-tree-slection` type prompt
 */

const fs = require('fs');
const path = require('path');

const chalk = require('chalk');
const {takeUntil} = require('rxjs/operators');
const figures = require('figures');
const cliCursor = require('cli-cursor');
const Base = require('inquirer/lib/prompts/base');
const observe = require('inquirer/lib/utils/events');
const Paginator = require('inquirer/lib/utils/paginator');



class FileTreeSelectionPrompt extends Base {
	
	
	getDirectoryContents(path=this.currentDirectory){
		const dirContents = fs.readdirSync(path);
		const mapped = dirContents.map(item => {
			const fullPath = path + '\\' + item;
			return fs.lstatSync(fullPath).isDirectory() ? 
				{fullPath: fullPath, isDirectory: true, displayString: figures.pointer + ' ' + item} : 
				{fullPath: fullPath, isDirectory: false, displayString: item};
		});
		const sorted =[...mapped.filter(item => item.isDirectory), ...mapped.filter(item => !item.isDirectory)];
		console.log(sorted);
		return sorted;
	}
	
	constructor(questions, rl, answers) {
		super(questions, rl, answers);

		this.currentDirectory = path.resolve(process.cwd(), this.opt.path || '.');
		this.directoryContents = this.getDirectoryContents();
		this.shownList = [];
		this.firstRender = true;
		this.selected =  this.directoryContents[0];



		// Make sure no default is set (so it won't be printed)
		this.opt.default = null;
		this.opt.pageSize = 10;

		this.paginator = new Paginator(this.screen);
	}

	/**
   * Start the Inquiry session
   * @param  {Function} cb  Callback when prompt is done
   * @return {this}
   */

	_run(cb) {
		this.done = cb;

		var self = this;


		var events = observe(this.rl);
		events.normalizedUpKey
			.pipe(takeUntil(events.line))
			.forEach(this.onUpKey.bind(this));
		events.normalizedDownKey
			.pipe(takeUntil(events.line))
			.forEach(this.onDownKey.bind(this));
		//   events.keypress
		//   .pipe(takeUntil(events.line))
		//   .forEach(k => this.onKeypress.bind(this, k));

		events.line
			.forEach(this.onSubmit.bind(this));

		
		cliCursor.hide();
		if (this.firstRender) {
			this.render();
		}

		return this;

	}

	renderDirectoryContents(directoryContents = this.directoryContents, indent = 2) {
		let output = '';

		directoryContents.forEach(directoryItem => {
			

			this.shownList.push(directoryItem.displayString);

			if (directoryItem.displayString === this.selected.displayString) {
				output += '\n' + chalk.cyan(directoryItem.displayString);
			}
			else {
				output += '\n' +  directoryItem.displayString;
			}
		});

		return output;
	}

	/**
   * Render the prompt to screen
   * @return {FileTreeSelectionPrompt} self
   */

	render() {
		// Render question
		var message = this.getQuestion();

		if (this.firstRender) {
			message += chalk.dim('(Use arrow keys to navigate; esc to move to parent directory)');
		}

		if (this.status === 'answered') {
			message += chalk.cyan(this.selected.fullPath);
		}
		else {
			this.shownList = [];
			const directoryString = this.renderDirectoryContents();
			message += '\n' + this.paginator.paginate(directoryString + '\n\n-----------------\n', this.shownList.indexOf(this.selected.displayString), this.opt.pageSize);
		}

		this.firstRender = false;
		this.screen.render(message);
	}

	/**
   * When user press `enter` key
   */

	onSubmit() {
		if(this.selected.isDirectory){
			this.status = 'answered';

			this.render();

			this.screen.done();
			cliCursor.show();
			this.done(this.selected.fullPath);
		}
		else{
			this.currentDirectory = this.selected.fullPath;
			this.directoryContents = this.getDirectoryContents();
			this.selected = this.directoryContents[0];
			this.render();
		}
	}

	moveselected(distance = 0) {
		const currentIndex = this.shownList.indexOf(this.selected.displayString);
		let index = currentIndex + distance;

		if (index >= this.shownList.length) {
			index = this.shownList.length - 1;
		}
		else if (index < 0) {
			index = 0;
		}

		this.selected = this.directoryContents.find(item => item.displayString === this.shownList[index]);

		this.render();
	}

	/**
   * When user press a key
   */
	onUpKey() {
		this.moveselected(-1);
	}

	onDownKey() {
		this.moveselected(1);
	}

	onSpaceKey() {
		if (!this.selected.children) {
			return;
		}

		this.selected.open = !this.selected.open;
		this.render();
	}
}

module.exports = FileTreeSelectionPrompt;