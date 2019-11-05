'use strict';
/**
 * `file-tree-slection` type prompt
 */

const fs = require('fs');
const path = require('path');

const chalk = require('chalk');
const {filter, takeWhile} = require('rxjs/operators');
const figures = require('figures');
const cliCursor = require('cli-cursor');
const Base = require('inquirer/lib/prompts/base');
const observe = require('inquirer/lib/utils/events');
const Paginator = require('./paginatorNonInfinite');



class FileTreeSelectionPrompt extends Base {
	static get EMPTY_OPTION_TEXT() {
		return '<none>'
	}

	static get EMPTY_OPTION_ID() {
		return -1
	}

	static get PARENT_DIR_TEXT() {
		return path.join('..', '/')
	}

	static get PARENT_DIR_ID() {
		return -2
	}

	static get CURR_DIR_TEXT() {
		return path.join('.', '/')
	}

	static get CURR_DIR_ID() {
		return -3
	}


	getDirectoryContents(dirPath=this.currentDirectory){
		const dirContents = fs.readdirSync(dirPath);
		const mapped = dirContents.map((item, index) => {
			const fullPath = path.join(dirPath, item);
			let result = {id: index, fullPath: fullPath}
			if (fs.lstatSync(fullPath).isDirectory()) {
				result = {...result, isDirectory: true, displayString: figures.pointer + ' ' + item};
			} else {
				result = {...result, isDirectory: false, displayString: item};
			}
			return result;
		});
		let sorted =[...mapped.filter(item => item.isDirectory), ...mapped.filter(item => !item.isDirectory)];

		const parentDir = path.resolve(dirPath, '..')
		if (parentDir !== dirPath) {
			sorted = [{
				id: this.constructor.PARENT_DIR_ID,
				fullPath: path.resolve(parentDir),
				isDirectory: true,
				displayString: this.constructor.PARENT_DIR_TEXT
			}, ...sorted]
		}

		sorted = [{
			id: this.constructor.CURR_DIR_ID,
			fullPath: dirPath,
			isDirectory: true,
			displayString: this.constructor.CURR_DIR_TEXT
		}, ...sorted]

		if (this.opt.allowNoneOption) {
			sorted = [{
				id: this.constructor.EMPTY_OPTION_ID,
				fullPath: '',
				isNone: true,
				displayString: this.constructor.EMPTY_OPTION_TEXT
			}, ...sorted]
		}
		return sorted;
	}

	constructor(questions, rl, answers) {
		super(questions, rl, answers);

		this.currentDirectory = path.resolve(process.cwd(), this.opt.path || '.');
		this.directoryContents = this.getDirectoryContents();
		this.shownList = [];
		this.firstRender = true;
		this.invalidSelection = false;

		this.opt = {
			...{
				path: null,
				pageSize: 10 ,
				allowNoneOption: false,
				onlyShowMatchingExtensions: false,
				selectionType: 'file',
				extensions: [],
			},
			...this.opt
			}

		// Make sure no default is set (so it won't be printed)
		this.opt.default = null;
		this.opt.pageSize = 10;

		this.paginator = new Paginator(this.screen);
		this.history = []
	}

	/**
   * Start the Inquiry session
   * @param  {Function} cb  Callback when prompt is done
   * @return {this}
   */

	_run(cb) {
		this.done = cb;

		const events = observe(this.rl)

		events.normalizedUpKey
			.pipe(takeWhile(() => this.status !== 'answered'))
			.forEach(this.onUpKey.bind(this));
		events.normalizedDownKey
		.pipe(takeWhile(() => this.status !== 'answered'))
		.forEach(this.onDownKey.bind(this));
		events.spaceKey
		.pipe(takeWhile(() => this.status !== 'answered'))
		.forEach(this.onSpaceKey.bind(this));
		events.keypress
		.pipe(takeWhile(() => this.status !== 'answered'))
		.pipe(filter(key => key.key.name === 'escape'))
		.forEach(this.onEscKey.bind(this));
		events.keypress
		.pipe(takeWhile(() => this.status !== 'answered'))
		.pipe(filter(key => key.key.name === 'right'))
		.forEach(this.onRightKey.bind(this));
		events.keypress
		.pipe(takeWhile(() => this.status !== 'answered'))
		.pipe(filter(key => key.key.name === 'left'))
		.forEach(this.onLeftKey.bind(this));


		events.line
			.forEach(this.onSubmit.bind(this));


		cliCursor.hide();
		if (this.firstRender) {
			this.renderNewDirectory(this.currentDirectory);
		}

		return this;

	}

	renderNewDirectory(dirPath){
	  if (this.currentDirectory !== dirPath) {
			this.history.push(this.currentDirectory)
		}
		this.currentDirectory = dirPath
		this.directoryContents = this.getDirectoryContents()
		this.shownList = this.getShownList()
		this.selected = this.shownList.length ? this.shownList[0] : undefined
		this.invalidSelection = false;
		this.renderCurrentDirectory()
	}



	getShownList(){
		let shownList
		if(this.opt.onlyShowMatchingExtensions){
			shownList = this.directoryContents.filter(directoryItem => {
				return directoryItem.isDirectory || directoryItem.isNone || this.opt.extensions.some(extension => {
					return directoryItem.fullPath.endsWith(extension)
				})
			})
		}
		else{
			shownList = [...this.directoryContents]
		}

		return shownList
	}

	/**
   * Render the prompt to screen
   * @return {FileTreeSelectionPrompt} self
   */

	renderCurrentDirectory() {
		// Render question
		let message = this.getQuestion();


		if (this.firstRender) {
			this.firstRender = false;
		}



		if (this.status === 'answered') {
			message += chalk.cyan(this.selected.fullPath);
		}
		else {
			message += ' ' + chalk.gray(this.currentDirectory)
			if(this.invalidSelection){
				message+='\n' + chalk.red("Invalid selection. Please choose another option.") +'\n';
			}
			const directoryString = this.convertDirectoryContentToString(this.shownList);
			const selectedIndex = this.selected ?
					this.shownList.findIndex(directoryItem => directoryItem.id === this.selected.id) : undefined;
			message += '\n' + this.paginator.paginate(directoryString + '\n \n\n',
					selectedIndex, this.opt.pageSize);
		}

		this.screen.render(message);
	}

	convertDirectoryContentToString(directoryContents = this.directoryContents, indent = 2) {
		let output = '';

		directoryContents.forEach(directoryItem => {
			if (directoryItem.id === this.selected.id) {
				if(this.selected.isNone || this.selected.isDirectory || this.checkValidExtension(this.selected.displayString)){
					output += '\n' + chalk.hex('#0598BC')(directoryItem.displayString);
				}
				else{
					output += '\n' + chalk.hex('#8dabb3')(directoryItem.displayString);
				}
			}
			else {
				if(this.isNone || this.isDirectory || this.checkValidExtension(directoryItem.displayString)){
				output += '\n' +  directoryItem.displayString;
			}
			else{
				output += '\n' +  chalk.hex('#8f8f8f')(directoryItem.displayString);
			}
		}
	});

		return output;
	}

	/**
   * When user press `enter` key
   */

	onSubmit() {
		const valid = this.checkValidSelection()
		if (!valid) {
			this.invalidSelection = true;
			this.renderCurrentDirectory()
			return;
		}
		else{

			this.status = 'answered';

			this.renderCurrentDirectory();

			this.screen.done();
			cliCursor.show();
			this.done(this.selected.fullPath);
		}
	}



	checkValidSelection(){
		if(this.selected.isDirectory){
			return this.opt.selectionType === 'folder'
		}
		else if (this.selected.isNone) {
			return true
		}
		else {
			return this.opt.selectionType === 'file' && this.checkValidExtension(this.selected.displayString)

		}
	}

	checkValidExtension(item){
		return this.opt.extensions.length ===0 || this.opt.extensions.some(extension => {
			return item.endsWith(extension)
	})
}

	moveSelected(distance = 0) {
		const currentIndex = this.shownList.findIndex(directoryItem => directoryItem.id === this.selected.id);
		let index = currentIndex + distance;
		if (index >= this.shownList.length) {
			index = this.shownList.length - 1;
		}
		else if (index < 0) {
			index = 0;
		}

		this.selected = this.shownList.length ? this.shownList[index] : undefined

		this.renderCurrentDirectory();
	}

	/**
   * When user press a key
   */
	onUpKey() {
		this.moveSelected(-1);
	}

	onDownKey() {
		this.moveSelected(1);
	}

	onLeftKey() {
		return this.onEscKey()
	}

	onRightKey() {
		if (this.selected && this.selected.isDirectory && this.selected.id !== this.constructor.CURR_DIR_ID &&
				this.selected.id !== this.constructor.PARENT_DIR_ID) {
			return this.onSpaceKey()
		} else if (this.history.length) {
		  const dirPath = this.history.pop()
			this.renderNewDirectory(dirPath)
			this.history.pop()
		}
	}

	onSpaceKey() {
		if (!this.selected || !this.selected.isDirectory || this.selected.id === this.constructor.CURR_DIR_ID) {
			return;
		}
		this.renderNewDirectory(this.selected.fullPath);
	}

	onEscKey(){
		const parentDir = path.resolve(this.currentDirectory, '..')
		if (parentDir !== this.currentDirectory) {
			this.renderNewDirectory(parentDir)
		}
	}

}

module.exports = FileTreeSelectionPrompt;
