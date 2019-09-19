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
		return sorted;
	}
	
	constructor(questions, rl, answers) {
		super(questions, rl, answers);

		this.currentDirectory = path.resolve(process.cwd(), this.opt.path || '.');
		this.directoryContents = this.getDirectoryContents();
		this.shownList = [];
		this.firstRender = true;



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
		events.spaceKey
			.pipe(takeUntil(events.line))
			.forEach(this.onSpaceKey.bind(this));

		events.line
			.forEach(this.onSubmit.bind(this));

		
		cliCursor.hide();
		if (this.firstRender) {
			this.renderNewDirectory(this.currentDirectory);
		}

		return this;

	}

	renderNewDirectory(path){
		this.currentDirectory = path
		this.directoryContents = this.getDirectoryContents()
		this.shownList = this.getShownList()
		this.selected = this.directoryContents.find(directoryItem => directoryItem.displayString === this.shownList[0])
		this.renderCurrentDirectory()
	}

	

	getShownList(){
		let shownList = undefined
		if(this.opt.onlyShowMatchingExtensions){
			shownList = this.directoryContents.filter(directoryItem => {
				return this.opts.extensions.some(extension => {
					return directoryItem.displayString.endsWith(extension)
				}) || directoryItem.isDirectory
			})
		}
		else{
			shownList = this.directoryContents
		}

		return shownList.map(item => item.displayString)
	}

	/**
   * Render the prompt to screen
   * @return {FileTreeSelectionPrompt} self
   */

	renderCurrentDirectory() {
		// Render question
		var message = this.getQuestion();

		if (this.firstRender) {
			message += chalk.dim('(Use arrow keys to navigate; esc to move to parent directory)');
			this.firstRender = false;
		}

		if (this.status === 'answered') {
			message += chalk.cyan(this.selected.fullPath);
		}
		else {
			const directoryString = this.convertDirectoryContentToString();
			message += '\n' + this.paginator.paginate(directoryString + '\n\n-----------------\n', this.shownList.indexOf(this.selected.displayString), this.opt.pageSize);
		}

		this.screen.render(message);
	}

	convertDirectoryContentToString(directoryContents = this.directoryContents, indent = 2) {
		let output = '';

		directoryContents.forEach(directoryItem => {
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
   * When user press `enter` key
   */

	onSubmit() {
		if(!this.selected.isDirectory){
			this.status = 'answered';

			this.renderCurrentDirectory();

			this.screen.done();
			cliCursor.show();
			this.done(this.selected.fullPath);
		}
		else{
			this.renderNewDirectory(this.selected.fullPath)
		}
	}

	checkValidSelection(){
		if(this.selected.isDirectory){
			return this.selectionType === 'folder'
		}
		else {
			return this.selectionType === 'file' && this.opts.extensions.some(extension => {
				return directoryItem.displayString.endsWith(extension)
			})
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

		this.renderCurrentDirectory();
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
		if (!this.selected.isDirectory) {
			return;
		}
		this.renderNewDirectory(this.selected.fullPath);
	}
}

module.exports = FileTreeSelectionPrompt;