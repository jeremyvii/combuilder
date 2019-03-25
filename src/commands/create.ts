import {Command, flags} from '@oclif/command';
import * as fs from 'fs';
import * as extra from 'fs-extra';
import * as gitConfig from 'git-config';
import * as path from 'path';

/**
 * User's name and email pull from git settings
 */
interface GitSettings {
  name: string;
  email: string;
}

interface Placeholders {
  [key: string]: string;
}

/**
 * What is returned by `git-config`
 */
interface GitSync {
  user: {
    [key: string]: string;
  };
}

/**
 * Defines data that will be replaced. Key is what will be replaced, value is
 * the replacement
 */
interface Replacement {
  [key: string]: string;
  author: string;
  createDate: string;
  email: string;
  item: string;
  Item: string;
  ITEM: string;
  items: string;
  Items: string;
  ITEMS: string;
  name: string;
  Name: string;
  NAME: string;
  url: string;
}

export default class Create extends Command {
  /**
   * Description to display via CLI
   *
   * @var  {string}
   */
  static description = 'creates a Joomla component based on options provided';

  /**
   * List of examples to display when just the main command is ran
   *
   * @var  {string[]}
   */
  static examples = [
    '$ combuilder create NAME VIEW',
  ];

  static flags = {
    author: flags.string({
      char: 'a',
      description: 'author name for component metadata',
      required: false,
    }),

    createDate: flags.string({
      char: 'd',
      description: 'created date for component metadata, current date is used if this option isn\'t present',
      required: false,
    }),

    email: flags.string({
      char: 'e',
      description: 'email address for component metadata',
      required: false,
    }),

    help: flags.help({char: 'h'}),

    url: flags.string({
      char: 'u',
      description: 'url for component metadata',
      required: false
    }),

    useGit: flags.boolean({
      char: 'g',
      description: 'populate author and email metadata with name and email from git configuration',
      required: false
    }),
  };

  /**
   * List of arguments specific to this command
   *
   * @var  {Arg[]}
   */
  static args = [
    {
      name: 'name',
      description: 'name of the component you wish to create',
      required: true,
    },
    {
      name: 'view',
      description: 'name of first view (item and list) to create',
      required: true
    }
  ];

  /**
   * Create object replacement data based on CLI arguments
   *
   * @return  {Replacement}  Key is what will be replaced, value is the
   *                         replacement
   */
  protected createReplacementData(): Replacement {
    const { args, flags } = this.parse(Create);
    // Try to pull component metadata from user arguments
    let author = '';
    if (flags.author) {
      author = flags.author;
    }

    let createDate = '';
    if (flags.createDate) {
      createDate = flags.createDate;
    } else {
      // Use current date if none provided by user
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      const date = new Date();
      createDate = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    }

    let email = '';
    if (flags.email) {
      email = flags.email;
    }

    let url = '';
    if  (flags.url) {
      url = flags.url;
    }

    // Check if user requested to use name and email from their git
    // configuration
    if (flags.useGit) {
      const gitSettings = this.getGitSettings();
      author = gitSettings.name;
      email = gitSettings.email;
    }

    // Conveniently capitalize strings
    const capitalize = (s: string): string => {
      if (typeof s !== 'string') return '';
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    // Format component name as lowercase, class case, and uppercase
    let name = <string>args.name;
    let Name = capitalize(name);
    let NAME = name.toUpperCase();
    // Format view name as lowercase, class case, and uppercase
    let item = <string>args.view;
    let Item = capitalize(item);
    let ITEM = item.toUpperCase();
    // Make view plural for list view
    let items = `${item}s`;
    let Items = `${Item}s`;
    let ITEMS = `${ITEM}S`;
    return {author, createDate, email, item, Item, ITEM, items, Items, ITEMS,
      name, Name, NAME, url,}
  }

  /**
   * Pull name and email from user's git configuration
   *
   * @return  {GitSettings}  Object containing user's name and email from git
   *                         settings
   */
  protected getGitSettings(): GitSettings {
    const settings = <GitSync>gitConfig.sync();
    return {
      name: settings.user.name,
      email: settings.user.email,
    }
  }

  async run() {
    const { args } = this.parse(Create);
    // Create component with com_ prefix
    const comName = `com_${args.name}`;
    // Create component directory
    fs.mkdirSync(comName);
    // Resolve path to this packages skeleton template directory
    const skeleton = path.resolve(__dirname, '../../templates/skeleton');
    // Copy over template to new directory
    extra.copySync(skeleton, comName);
    // Rename placeholder files in newly created component source
    this.renameFiles(comName, args.name, args.view);
    // Replace data if information provided via arguments
    // (@see this.createReplacementData())
    this.replaceData(comName);

    this.log(`${comName} successfully created`);
  }

  /**
   * Recursively get rename all files and folders containing placeholder names
   * in newly generated component folder
   *
   * @param   {string}  path  Path to start list operation in
   * @param   {string}  name  Name of component without com_ prefix
   * @param   {string}  view  Name of view to rename
   *
   * @return  {void}
   */
  protected renameFiles(path: string, name: string, view: string): void {
    // Get list of items to start renaming
    let items = fs.readdirSync(path);

    for (let item of items) {
      // Create path to current file or folder for manipulation if needed
      let newPath = `${path}/${item}`;
      // Files and folders containing the following names with be replaced
      const placeholders: Placeholders = {
        '-component_name-': name,
        '-item-': view,
        '-items-': `${view}s`,
      };
      // Loop over each in order to potentially rename
      for (let placeholder in placeholders) {
        // Check if current item matches current placeholder name
        if (item.includes(placeholder)) {
          // Replace placeholder with desired replacement
          const renamed = item.replace(placeholder, placeholders[placeholder]);
          // Use Node JS API to rename file or folder
          fs.renameSync(`${path}/${item}`, `${path}/${renamed}`);
          // Reset newPath part in case current item is a folder. Otherwise
          // recursive operation would not go deeper
          newPath = `${path}/${renamed}`;
        }
      }
      // Check if current item is folder
      if (fs.lstatSync(newPath).isDirectory()) {
        // Recursive call current method to start the next folder operation
        this.renameFiles(newPath, name, view);
      }
    }
  }

  /**
   * Recursively replace placeholders with data provided by the user
   *
   * @param   {string}  path  Path to current directory context
   *
   * @return  {void}
   */
  protected replaceData(path: string): void {
    let items = fs.readdirSync(path);
    // Get data to replace. The object key is what will be replaced, the value
    // is the replacement
    let replacements = this.createReplacementData();

    for (let item of items) {
      // Build path to current item, if this is a directory it will be passed
      // to next recursive call
      let nextPath = `${path}/${item}`;
      // Check if item is a file to determine file level find and replace is
      // warranted
      if (fs.lstatSync(nextPath).isFile()) {
        let file = fs.readFileSync(nextPath, 'utf8');
        // Loop over replacement data in order to start find and replace
        for (let replacement in replacements) {
          // Build expression for finding values that need replaced globally in
          // file
          const expr = new RegExp(`(\{\{${replacement}\}\})`, 'g');
          if (expr.test(file)) {
            // Replace every instance of found replacement
            file = file.replace(expr, replacements[replacement]);
          }
        }
        // Rewrite newly modified with replacement data
        fs.writeFileSync(nextPath, file);
      }
      // Check if item is a directory in order to start recursive actions
      if (fs.lstatSync(nextPath).isDirectory()) {
        this.replaceData(nextPath);
      }
    }
  }
}
