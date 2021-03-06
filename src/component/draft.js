import React from 'react';
import {Editor, EditorState, DefaultDraftBlockRenderMap, RichUtils, ContentState, convertToRaw, convertFromRaw, Modifier, CompositeDecorator} from 'draft-js';
import ReactDOM from 'react-dom';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import getMuiTheme from 'material-ui/styles/getMuiTheme';
import AppBar from 'material-ui/AppBar';
import Drawer from 'material-ui/Drawer';
import RaisedButton from 'material-ui/RaisedButton';
import DropDownMenu from 'material-ui/DropDownMenu';
import Menu from 'material-ui/Menu';
import MenuItem from 'material-ui/MenuItem';
import TextField from 'material-ui/TextField'
import SelectField from 'material-ui/SelectField';
import {List, ListItem} from 'material-ui/List';
import _ from 'underscore';
import io from 'socket.io-client'

import randomColor from 'randomcolor';


class Draft extends React.Component {
  constructor(props) {
    var color = randomColor().toString();

    super(props);
    this.state = {
      editorState: EditorState.createEmpty(),
      currentPage: 'draft',
      online: [],
      title: 'Untitled Doc',
      contentHistory: [],
      saved: false,
      collaborators: [],
      currentDocument: {},
      autosave: false,
      online: [],
      search: '',
      highlightStart: 0,
      highlightStop:0,
      randomColor:color,
      saveHistory: false,
      saveDates: props.saveDates
    };
    this.handleKeyCommand=this.handleKeyCommand.bind(this);
    this.toggleColor = (toggledColor) => this._toggleColor(toggledColor);
    this.previousHighlight = null;
    this.interval = setInterval(this._onSave.bind(this), 10000);
  }

hangleToggle = () => {
  this.setState({
    open: !this.state.open
  })
}


  onChange = (editorState) => {
    const {socket} = this.props
    this.setState({editorState, saved: false}, () => {
      socket.emit('syncDocument', {
        _id: this.props.id,
        rawState: convertToRaw(editorState.getCurrentContent()),
      });
    })

    const selection = editorState.getSelection();
    console.log('highlight', selection.anchorOffset, selection.focusOffset)

    this.setState({highlightStart: selection.anchorOffset, highlightStop: selection.focusOffset}, () => {
      socket.emit('highlight', {
        _id: this.props.id,
        start: selection.anchorOffset,
        stop: selection.focusOffset
      })
    })

    socket.on('receiveNewCursor', (data) => {
      if (selection.anchorOffset === selection.focusOffset) {
        const windowSelection = window.getSelection();
        if (windowSelection.rangeCount>0) {
          var ranges = [];
          var clientRects;
          for (var i = 0; i < windowSelection.rangeCount; i++) {
            ranges[i] = windowSelection.getRangeAt(i);
            clientRects = ranges[i].getClientRects();
        }
          console.log('clientRects', clientRects)
          if (clientRects.length >0) {
            const rects = clientRects[0];
            console.log('location', rects);
            const {top, left, bottom} = rects
            const loc = {top: rects.top, bottom: rects.bottom, left: rects.left}
            var data = {incomingSelectionObj: selection, loc: loc}
            console.log('data', data)
            socket.emit('cursorMove', data)
          }
        }
      }
      // console.log('in receive of cursor mvoemnt');
      const incomingSelectionObj = data.incomingSelectionObj
      const loc = data.loc
      let editorState = this.state.editorState;
      const originalEditorState = editorState;
      const originalSelection = this.state.editorState.getSelection();
      //take the original selection stateand change all its values to be the selectionstateobj  that we just received
      const incomingSelectionState = originalSelection.merge(incomingSelectionObj)
      const temporaryEditorState = EditorState.forceSelection(originalEditorState, incomingSelectionState)

      if(temporaryEditorState) {
        this.setState({editorState: temporaryEditorState}, function() {
          //were now referring to browser selectionstateobjc
          if(loc && loc.top && loc.bottom && loc.left) {
            this.setState({editorState: originalEditorState, top: loc.top, left: loc.left, height: loc.bottom - loc.top})
          }
        })
      } else {
        console.log('temportaray state undefined wtf');
      }
    })

    var start_high = selection.focusOffset
    var stop_high = selection.anchorOffset
    if(start_high < stop_high){
      this.setState({highlightStart: start_high, highlightStop: stop_high}, () => {
        socket.emit('highlight', {
          _id: this.props.id,
          start: start_high,
          stop: stop_high
        })
      })
    }else{
      this.setState({highlightStart: stop_high, highlightStop: start_high}, () => {
        socket.emit('highlight', {
          _id: this.props.id,
          start: stop_high,
          stop: start_high
        })
      })
    }
  }


  componentWillUnmount() {
    this.socket.emit('disconnect');
    this.socket.close();
    clearInterval(this.interval);
  }

  SearchHighlight = (props) => (
  <span className="search-highlight">{props.children}</span>
);

generateDecorator = (highlightTerm) => {
  const regex = new RegExp(highlightTerm, 'g');
  return new CompositeDecorator([{
    strategy: (contentBlock, callback) => {
      if (highlightTerm !== '') {
        this.findWithRegex(regex, contentBlock, callback);
      }
    },
    component: this.SearchHighlight,
  }])
};

findWithRegex = (regex, contentBlock, callback) => {
const text = contentBlock.getText();
let matchArr, start, end;
while ((matchArr = regex.exec(text)) !== null) {
  start = matchArr.index;
  end = start + matchArr[0].length;
  callback(start, end);
}
};

onChangeSearch = (e) => {
  const search = e.target.value;
  this.setState({
    search,
    editorState: EditorState.set(this.state.editorState, { decorator: this.generateDecorator(search) }),
  });
}

  handleClick = event => {
    this.setState({anchorE1: event.currentTarget})
  }
  handleClose = () => {
    this.setState({anchorE1: null})
  }

  _onBoldClick() {
    this.onChange(RichUtils.toggleInlineStyle(this.state.editorState, 'BOLD'));
  }

  _onItalicsClick() {
    this.onChange(RichUtils.toggleInlineStyle(this.state.editorState, 'ITALIC'));
  }

  _onUnderlineClick() {
    this.onChange(RichUtils.toggleInlineStyle(this.state.editorState, 'UNDERLINE'));
  }

  _onLeftAlignClick() {
    this.onChange(RichUtils.toggleBlockType(this.state.editorState, 'left'));
  }

  _onCenterAlignClick() {
    this.onChange(RichUtils.toggleBlockType(this.state.editorState, 'center'));
  }

  _onRightAlignClick() {
    this.onChange(RichUtils.toggleBlockType(this.state.editorState, 'right'));
  }

  _onH1CLick() {
    this.onChange(RichUtils.toggleBlockType(this.state.editorState, 'header-one'));
  }

  _onH2CLick() {
    this.onChange(RichUtils.toggleBlockType(this.state.editorState, 'header-two'));
  }

  _onH3CLick() {
    this.onChange(RichUtils.toggleBlockType(this.state.editorState, 'header-three'));
  }
  _onH4CLick() {
    this.onChange(RichUtils.toggleBlockType(this.state.editorState, 'header-four'));
  }

  _onH5CLick() {
    this.onChange(RichUtils.toggleBlockType(this.state.editorState, 'header-five'));
  }

  _onH6CLick() {
    this.onChange(RichUtils.toggleBlockType(this.state.editorState, 'header-six'));
  }

  _onBulletListClick() {
    this.onChange(RichUtils.toggleBlockType(this.state.editorState, 'unordered-list-item'));
  }

  _onNumberedListClick() {
    this.onChange(RichUtils.toggleBlockType(this.state.editorState, 'ordered-list-item'));
  }

  _onCenterAlignClick() {
    this.onChange(RichUtils.toggleBlockType(this.state.editorState, 'center'));
  }

  _onRightAlignClick() {
    this.onChange(RichUtils.toggleBlockType(this.state.editorState, 'right'));
  }

  _onLeftAlignClick() {
    this.onChange(RichUtils.toggleBlockType(this.state.editorState, 'left'));
  }

  _toggleColor(toggledColor) {
    const {editorState} = this.state.editorState;
    const selection = editorState.getSelection();

    const nextContentState = Object.keys(colorStyleMap)
    .reduce((contentState, color) => {
      return Modifier.removeInlineStyle(contentState, selection, color)
    }, editorState.getCurrentContent());

    let nextEditorState = EditorState.push(
      editorState,
      nextContentState,
      'change-inline-style'
    );

    const currentStyle = editorState.getCurrentInlineStyle();

    if(selection.isCollapsed()) {
      nextEditorState = currentStyle.reduce((state, color) => {
        return RichUtils.toggleInlineStyle(state, color);
      }, nextEditorState);
    }

    if (!currentStyle.has(toggledColor)) {
      nextEditorState = RichUtils.toggleInlineStyle(
        nextEditorState,
        toggledColor
      );
    }

    this.onChange(nextEditorState);
  }

  myBlockStyleFn(contentBlock) {
    const type = contentBlock.getType();
    if (type === 'left') {
      return 'align-left';
    }
    if (type === 'center') {
      return 'align-center';
    }
    if (type === 'right') {
      return 'align-right';
    }
  }

  _onSave() {
    // var newContent = JSON.stringify(convertToRaw(this.state.editorState.getCurrentContent()));
    const date = new Date()
    var contentState = convertToRaw(this.state.editorState.getCurrentContent());
    var newContentHistory = this.state.contentHistory.slice();
    newContentHistory.push(contentState);
    var newTitle = this.state.title;
    var rawContent = this.state.editorState.getCurrentContent();
    //var currentDocument = Object.assign({}, {content: rawContent})
    // var array1=this.state.historyArr.slice();
    // array1.push(contentState);
    let saveDates = [...this.state.saveDates, date]
    this.setState({saveDates, contentHistory: newContentHistory, saved: true, title: newTitle, editorState: EditorState.createWithContent(rawContent)}, () => {
      // this.socket.emit('newContentHistory', this.state.contentHistory)
    })

    fetch('http://3705620f.ngrok.io/savedoc', {
      method: 'POST',
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify({
        documentID: this.props.id,
        editorState: contentState,
        saveDates: date
      })
    })
    .then((response) => {
      console.log("response", response)
      if (response.status === 200) {
        return response.json()
      }
      else {
        console.log("error");
      }
    })
    .then((resp) => {
      console.log(resp.success);
    })
    // .then((responseJson) => {
    //   console.log('response 2', responseJson)
    //   if (responseJson.success){
    //     this.props.redirect('Content')
    //   }
    //   else {
    //     console.log("ERROR", responseJson.error)
    //   }
    // })
    .catch((err) => {
      console.log("ANOTHA ERR", err)
      /* do something if there was an error with fetching */
    });
  }

  viewChanges = (index) => {
    console.log("HISTORY", this.state.contentHistory);
    var arr= this.state.contentHistory.slice()
    var specificIndex = arr[index]
    if (typeof specificIndex === "string") {
      specificIndex = JSON.parse(specificIndex);
    }
    if (specificIndex.entityMap == null) {
      specificIndex.entityMap = {};
    }
  console.log("xxxxx", specificIndex)
    this.setState({
      editorState: EditorState.createWithContent(convertFromRaw(specificIndex))
    })
  }

  viewHistory = () => {
    this.setState({
      saveHistory: !this.state.saveHistory
    })
  }

  finishChanges = () => {
    if (this.state.saved === false) {
      alert('Make sure you save first!')
    } else {
      this.props.redirect('Content')
    }
  }

  onTitleEdit(event) {
    this.setState({saved: false, title: event.target.value})
    console.log(this.state.title)
  }

  handleKeyCommand(command, editorState) {
    const newState = RichUtils.handleKeyCommand(editorState, command);
    if (newState) {
      this.onChange(newState);
      return 'handled';
    }
    return 'not-handled'
  }

  componentDidMount() {
    const {socket} = this.props
    socket.emit('openDoc', {
      _id: this.props.id
    })
    console.log("this.props.save", this.props.saveDates)
    socket.on('syncDocument', this.remoteStateChange)
    socket.on('highlight', this.remoteStateChangeHigh)

    console.log("contentHistory", this.props.contentHistory)
    if (this.props.contentHistory.length) {
      console.log("contentHistory1", "hi")

      var newArr = this.props.contentHistory.slice();

      let lastDoc = newArr[newArr.length - 1];

      if (typeof lastDoc === "string") {
        lastDoc = JSON.parse(lastDoc);
      }
      if (lastDoc.entityMap == null) {
        lastDoc.entityMap = {};
      }
      console.log(newArr)
      this.setState({
        contentHistory: this.props.contentHistory.slice(),
        editorState: EditorState.createWithContent(convertFromRaw(lastDoc)),
      })
    }
  }

  remoteStateChange = (res) => {
    console.log('whatsupppp')
    this.setState({editorState: EditorState.createWithContent(convertFromRaw(res.rawState))})
  }

  HighHighlight = (props) => {
    return <span style={{backgroundColor: this.state.randomColor, color: 'black'}} >{props.children}</span>
    //<span style={{color: 'black', borderLeft: '1px solid blue'}} >{props.children}</span>
  }




BorderHighlight = (props) => (

 <span style={{color: 'black', borderRight: '1px solid blue'}} >{props.children}</span>

);


 generateDecoratorHigh = () => {
 const regex = new RegExp('lol', 'g');
 return new CompositeDecorator([{
   strategy: (contentBlock, callback) => {
     console.log('got here, thats cool')
     this.state.highlightStart !== this.state.highlightStop ? this.findWithRegexHigh(regex, contentBlock, callback) : this.findWithRegexBorder(regex, contentBlock, callback);
   },
   component: this.state.highlightStart !== this.state.highlightStop ? this.HighHighlight : this.BorderHighlight,
 }])
};

generateDecoratorBorder = () => {
const regex = new RegExp('lol', 'g');
return new CompositeDecorator([{
  strategy: (contentBlock, callback) => {
    console.log('got here, thats cool')
    this.findWithRegexBorder(regex, contentBlock, callback);
  },
  component: this.BorderHighlight,
}])
};


findWithRegexHigh = (regex, contentBlock, callback) => {
 console.log('in reg high start', this.state.highlightStart)
 console.log('in reg high stop', this.state.highlightStop)

 callback(this.state.highlightStart, this.state.highlightStop );
 // callback(this.state.highlightStart, this.state.highlightStop+1 );
};

findWithRegexBorder = (regex, contentBlock, callback) => {
 console.log('in reg border start', this.state.highlightStart)
 console.log('in reg border stop', this.state.highlightStop)
 if(this.state.hightlightStart === contentBlock.getLength()){

 }
 callback(this.state.hightlightStart === 0 ? this.state.highlightStart : this.state.highlightStart - 1, this.state.highlightStop );
};

 remoteStateChangeHigh = (res) => {
   console.log('high', res)
   this.setState({highlightStart: res.start, highlightStop: res.stop}, () => {
     console.log(this.state.highlightStart, this.state.highlightStop)
   })
  this.setState({editorState: EditorState.set(this.state.editorState, { decorator: this.generateDecoratorHigh() })})

 }

  render() {
    console.log('HEYY',this.state)
    const {editorState} = this.state;
    let className =  'RichEditor-editor';
    var contentState = editorState.getCurrentContent()
    if (!contentState.hasText()) {
      if (contentState.getBlockMap().first().getType() !== 'unstyled') {
        className +='RichEditor-hidePlaceholder'
      }
    }
    return (
      <MuiThemeProvider muiTheme={muiTheme} >
      <div>
        <AppBar title={this.props.title} onLeftIconButtonClick = {this.handleToggle} />
        <Drawer
          docked = {false}
          width = {200}
          open = {this.state.open}
          onRequestChange = {(open) => this.setState({open})}>

          <div className = "text-center">
          <AppBar title = "Menu" showMenuIconButton={false} />
          <MenuItem onClick = {this.finishChanges}>Back</MenuItem>
          </div>
        </Drawer>


      {this.state.saveHistory === false ?
      <div className="container">
        <div style={{display:'flex', flexDirection: 'row'}}>
          <div style = {{padding: '5%'}}>
            <TextField id="read-only-input"
              floatingLabelText = "Document ID"
              value= {this.props.id}
            />
          <div>
            <TextField
              hintText="Find in document"
              onChange={this.onChangeSearch} />
          </div>
          <div style={{border: '1px solid black', paddingBottom: 10}}>
            <div style={styles.toolbar}>
            <div style = {{display: 'inline-block', position: 'relative', top: '11px'}}>
            <SelectField
              hintText="Font Size" style={styles.textSizeField}
              dropDownMenuProps={{
                iconButton:<i className="material-icons">arrow_drop_down</i>
              }}>
              <MenuItem onClick={this._onH1CLick.bind(this)}>H1</MenuItem>
              <MenuItem onClick={this._onH2CLick.bind(this)}>H2</MenuItem>
              <MenuItem onClick={this._onH3CLick.bind(this)}>H3</MenuItem>
              <MenuItem onClick={this._onH4CLick.bind(this)}>H4</MenuItem>
              <MenuItem onClick={this._onH5CLick.bind(this)}>H5</MenuItem>
              <MenuItem onClick={this._onH6CLick.bind(this)}>H6</MenuItem>
            </SelectField>

            <SelectField
              hintText="Font Color" style={styles.fontColorField}
              dropDownMenuProps={{
                iconButton: <i className="material-icons" style={{paddingRight: 10}}>arrow_drop_down</i>
              }}>
              <ColorControls
                editorState={editorState}
                onToggle={this.toggleColor}
              />
            </SelectField>
            </div>
              <button>
                <i className="material-icons" onClick={this._onBoldClick.bind(this)}>format_bold</i>
              </button>
              <button>
                <i className="material-icons" onClick={this._onItalicsClick.bind(this)}>format_italic</i>
              </button>
              <button>
                <i className="material-icons" onClick={this._onUnderlineClick.bind(this)}>format_underlined</i>
              </button>
              <button>
                <i className="material-icons" onClick={this._onBulletListClick.bind(this)}>format_list_bulleted</i>
              </button>
              <button>
                <i className="material-icons" onClick={this._onNumberedListClick.bind(this)}>format_list_numbered</i>
              </button>

              <button>
                <i className="material-icons" onClick={this._onLeftAlignClick.bind(this)}>format_align_left</i>
              </button>

              <button>
                <i className="material-icons" onClick={this._onCenterAlignClick.bind(this)}>format_align_center</i>
              </button>

              <button>
                <i className="material-icons" onClick={this._onRightAlignClick.bind(this)}>format_align_right</i>
              </button>
            </div>
            <div className="editor" style={styles.editor} onClick={this.focus}>
              <Editor
                customStyleMap={colorStyleMap}
                editorState={editorState}
                onChange={this.onChange}
                textAlignment={'right'}
                hangleKeyCommand = {this.handleKeyCommand}
                blockStyleFn = {this.myBlockStyleFn}
                ref={(ref) => this.editor = ref}
              />
            </div>
            <div style={{paddingLeft: 10}}>
              <RaisedButton
                label={this.state.saved ? "Saved" : "Save"}
                onClick= {this._onSave.bind(this)}
                style={{marginRight: 10}}>
              </RaisedButton>
              <RaisedButton
                label= "View History"
                onClick = {() => this.viewHistory()}>
                </RaisedButton>
              <RaisedButton
                label="Finish Changes"
                onClick={this.finishChanges}>
              </RaisedButton>
            </div>
          </div>
      </div>
    </div>
  </div>
   : //THIS IS WHERE THE TURNARY IS
   <div className="container">
     <div style={{display:'flex', flexDirection: 'row'}}>
       <div style = {{flex: 3}}>
         <TextField id="read-only-input"
           floatingLabelText = "Document ID"
           value= {this.props.id}
         />
       <div>
         <TextField
           hintText="Find in document"
           onChange={this.onChangeSearch} />
       </div>
       <div style={{border: '1px solid black', paddingBottom: 10}}>
         <div style={styles.toolbar}>
         <div style = {{display: 'inline-block', position: 'relative', top: '11px'}}>
         <SelectField
           hintText="Font Size" style={styles.textSizeField}
           dropDownMenuProps={{
             iconButton:<i className="material-icons">arrow_drop_down</i>
           }}>
           <MenuItem onClick={this._onH1CLick.bind(this)}>H1</MenuItem>
           <MenuItem onClick={this._onH2CLick.bind(this)}>H2</MenuItem>
           <MenuItem onClick={this._onH3CLick.bind(this)}>H3</MenuItem>
           <MenuItem onClick={this._onH4CLick.bind(this)}>H4</MenuItem>
           <MenuItem onClick={this._onH5CLick.bind(this)}>H5</MenuItem>
           <MenuItem onClick={this._onH6CLick.bind(this)}>H6</MenuItem>
         </SelectField>

         <SelectField
           hintText="Font Color" style={styles.fontColorField}
           dropDownMenuProps={{
             iconButton: <i className="material-icons" style={{paddingRight: 10}}>arrow_drop_down</i>
           }}>
           <ColorControls
             editorState={editorState}
             onToggle={this.toggleColor}
           />
         </SelectField>
         </div>
           <button>
             <i className="material-icons" onClick={this._onBoldClick.bind(this)}>format_bold</i>
           </button>
           <button>
             <i className="material-icons" onClick={this._onItalicsClick.bind(this)}>format_italic</i>
           </button>
           <button>
             <i className="material-icons" onClick={this._onUnderlineClick.bind(this)}>format_underlined</i>
           </button>
           <button>
             <i className="material-icons" onClick={this._onBulletListClick.bind(this)}>format_list_bulleted</i>
           </button>
           <button>
             <i className="material-icons" onClick={this._onNumberedListClick.bind(this)}>format_list_numbered</i>
           </button>

           <button>
             <i className="material-icons" onClick={this._onLeftAlignClick.bind(this)}>format_align_left</i>
           </button>

           <button>
             <i className="material-icons" onClick={this._onCenterAlignClick.bind(this)}>format_align_center</i>
           </button>

           <button>
             <i className="material-icons" onClick={this._onRightAlignClick.bind(this)}>format_align_right</i>
           </button>
         </div>
         <div className="editor" style={styles.editor} onClick={this.focus}>
           <Editor
             customStyleMap={colorStyleMap}
             editorState={editorState}
             onChange={this.onChange}
             textAlignment={'right'}
             hangleKeyCommand = {this.handleKeyCommand}
             blockStyleFn = {this.myBlockStyleFn}
             ref={(ref) => this.editor = ref}
           />
         </div>
         </div>
         <div style={{paddingLeft: 10}}>
           <RaisedButton
             label={this.state.saved ? "Saved" : "Save"}
             onClick= {this._onSave.bind(this)}
             style={{marginRight: 10}}>
           </RaisedButton>
           <RaisedButton
             label= "View History"
             onClick = {() => this.viewHistory()}>
             </RaisedButton>
           <RaisedButton
             label="Finish Changes"
             onClick={this.finishChanges}
             style={{float: 'right'}}>
           </RaisedButton>
         </div>
       </div>
        <div style = {{flex: 1, marginLeft: '3%'}}>
          <div style = {{height: '96px'}}>
            <h3 className = "text-center">Save History </h3>
          </div>
        <div style = {{border: '3px solid teal', overflow: 'scroll', overflowX: 'hidden', padding: '2%', height: '80%'}}>
          <List>
            {this.state.saveDates.map((save, index) => <ListItem key = {index} primaryText = {"Save " + (index +1)} secondaryText = {new Date(save).toString().slice(4, 24)} onClick = {()=> this.viewChanges(index)} /> )}
          </List>
        </div>
        </div>
   </div>
 </div>}
</div>
</MuiThemeProvider>
    );
  }
}

class StyleButton extends React.Component {
  constructor(props) {
    super(props);
    this.onToggle = (e) => {
      e.preventDefault();
      this.props.onToggle(this.props.style);
    };
  }
  render() {
    let style;
    if (this.props.active) {
      style = {...styles.styleButton, ...colorStyleMap[this.props.style]};
    } else {
      style = styles.styleButton;
    }
    return (
      <span style={style} onMouseDown={this.onToggle}>
        {this.props.label}
      </span>
    );
  }
}

var COLORS = [
  {label: 'Red', style: 'red'},
  {label: 'Orange', style: 'orange'},
  {label: 'Yellow', style: 'yellow'},
  {label: 'Green', style: 'green'},
  {label: 'Blue', style: 'blue'},
  {label: 'Indigo', style: 'indigo'},
  {label: 'Violet', style: 'violet'},
];
const ColorControls = (props) => {
  var currentStyle = props.editorState.getCurrentInlineStyle();
  return (
    <div style={styles.controls}>
      {COLORS.map(type =>
        <div>
          <RaisedButton style={{boxShadow: '0px 0px 0px'}}>
            <StyleButton
              active={currentStyle.has(type.style)}
              label={type.label}
              onToggle={props.onToggle}
              style={type.style}
            />
          </RaisedButton>
        </div>
      )}
    </div>
  );
};

// This object provides the styling information for our custom color
// styles.
const colorStyleMap = {
  red: {
    color: 'rgba(255, 0, 0, 1.0)',
  },
  orange: {
    color: 'rgba(255, 127, 0, 1.0)',
  },
  yellow: {
    color: 'rgba(180, 180, 0, 1.0)',
  },
  green: {
    color: 'rgba(0, 180, 0, 1.0)',
  },
  blue: {
    color: 'rgba(0, 0, 255, 1.0)',
  },
  indigo: {
    color: 'rgba(75, 0, 130, 1.0)',
  },
  violet: {
    color: 'rgba(127, 0, 255, 1.0)',
  },
};
const styles = {
  toolbar: {
    borderBottom: '1px solid grey',
    paddingLeft: 10,
    display: 'flex',
    alignItems: 'center'
  },
  editor: {
    cursor: 'text',
    height: '20%',
    width: '80%',
    fontSize: 16
  },
  controls: {
    fontFamily: '\'Helvetica\', sans-serif',
    fontSize: 14,
    userSelect: 'none',
  },
  styleButton: {
    color: 'black'
  },
  textSizeField: {
    width: 100,
    height: 45,
    position: 'relative'
  },
  fontColorField: {
    width: 110,
    height: 45,
    position: 'relative',
    paddingLeft: 5
  }
};

const muiTheme = getMuiTheme({
  appBar: {
    height: 50,
  },
});

export default Draft;
