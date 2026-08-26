# Edit Suite

Build a Professional Video Editor — 

Create a modern browser-based video editor inspired by the workflow of professional editors such as CapCut, but with completely original UI design and branding.

The application should be functional, not a static mockup. Every feature requested below should actually work.

1. Overall Application

Build the editor as a desktop-style video editing application.

Use:

React

TypeScript

Modern CSS

HTML5 Video APIs

A clean component-based architecture

The application should be responsive for desktop screens, with the editor optimized for large screens.

Use a dark professional interface.

Do NOT add fake buttons or placeholder features that appear functional but do nothing.

2. Main Layout

Create this structure:

┌──────────────────────────────────────────────────────────────┐
│ Top Toolbar                                                  │
├────────────┬───────────────────────────────┬─────────────────┤
│            │                               │                 │
│ Left       │                               │   Properties    │
│ Panel      │          Video Preview        │     Panel       │
│            │                               │                 │
│            │                               │                 │
├────────────┴───────────────────────────────┴─────────────────┤
│                    Timeline                                  │
│                                                             │
│ V1  ─────── [ VIDEO CLIP ] ─────── [ VIDEO CLIP ]           │
│ V2  ───────────── [ VIDEO ] ─────────────────               │
│                                                             │
│ A1  ─────── [ AUDIO ] ───────────────────────               │
└──────────────────────────────────────────────────────────────┘


The layout should feel like a real video editor.

3. Top Toolbar

Create a top toolbar containing:

Project name

Undo

Redo

Save Project

Import Media

Export button

Preview/play controls where appropriate

Undo and redo must actually work.

Save Project should save the current editor state.

4. Left Panel

Create tabs for:

Media

Audio

Text

Captions

Effects

Transitions

For this phase, only Media needs to be fully functional.

The other tabs can exist visually but must clearly indicate that they are coming in later phases rather than pretending to work.

Media

Allow the user to:

Import video files

Import images

Import audio files

Display imported files as media items/thumbnails.

Allow the user to add imported media to the timeline.

Support common formats where the browser allows them.

5. Video Preview

Create a large video preview area.

Requirements:

Show the currently selected video

Play

Pause

Seek

Current time

Total duration

Playhead synchronization with timeline

Update preview when the playhead moves

Preview selected media correctly

Show a useful empty state when no media exists

The preview must actually display imported video.

6. Timeline

Create a functional multi-track timeline.

Support:

Video tracks

Audio tracks

Playhead

Timeline ruler

Time display

Zoom in/out

Clip selection

Clip dragging

Clip repositioning

Clip trimming

Clip deletion

Example:

TIME
00:00     00:05     00:10     00:15

V1   [──────── VIDEO 1 ────────][── VIDEO 2 ──]

V2             [──── VIDEO ─────────]

A1   [──────────── MUSIC ────────────────]

                 │
                 ▼
              PLAYHEAD


The playhead must control the video preview.

When the user presses Play, the playhead should move.

When the playhead moves, the preview should update.

7. Clip Selection

When a clip is selected:

Highlight the clip on the timeline

Load its properties into the Properties panel

Show its position on the timeline

Allow editing its properties

Only one clip needs to be selected at a time for now.

8. Properties Panel

This is a major part of Phase 2.

When a VIDEO or IMAGE clip is selected, display:

Transform

Position

X

Y

Size

Width

Height

Add a lock/unlock aspect ratio option.

Rotation

Rotation angle

Scale

Scale percentage

Opacity

Opacity percentage

Example:

PROPERTIES

Transform
────────────────────

Position
X       [ 0 ]
Y       [ 0 ]

Size
Width   [ 1920 ]
Height  [ 1080 ]

🔒 Lock Aspect Ratio

Rotation
[ 0° ]

Scale
[ 100% ]

Opacity
[ 100% ]


All values must actually modify the selected media in the preview.

9. Transform Controls in Preview

When a video/image is selected, show a bounding box around it in the preview.

Allow the user to:

Drag the media

Resize the media

Rotate the media

Changes made using the preview controls must update the Properties panel.

Changes made in the Properties panel must update the preview.

Both systems must stay synchronized.

10. Video/Image Rendering

The selected media should be rendered according to:

X position

Y position

Width

Height

Rotation

Scale

Opacity

Do not simply display the original video without applying these transformations.

Use a rendering architecture that can later support:

Keyframes

Effects

Filters

Text

Transitions

More advanced compositing

Design the code so these features can be added without rewriting the entire editor.

11. Clip Trimming

Allow the user to trim the beginning and end of a timeline clip.

Example:

Before:

[────────────────────────────]

After trimming:

      [──────────────]
      ↑              ↑
    START           END


Dragging either edge should change the clip's visible duration.

Do not destroy the original imported media.

Store the clip's:

source start time

source end time

timeline start time

timeline duration

12. Moving Clips

Allow clips to be dragged horizontally along their track.

Example:

Before:

V1  [VIDEO]

After:

V1        [VIDEO]


Moving a clip must update its timeline position.

Prevent clips from accidentally becoming inaccessible outside the timeline.

13. Delete Clips

Allow deleting the selected clip with:

Delete key

Backspace

Delete button

Ask for confirmation only if appropriate; normal clip deletion should feel fast.

14. Keyboard Shortcuts

Implement:

Space → Play/Pause

Delete → Delete selected clip

Ctrl + Z → Undo

Ctrl + Y → Redo

Ctrl + S → Save project

Arrow Left/Right → Move playhead

Shift + Arrow → Move playhead faster

Make sure shortcuts do not interfere with text inputs.

15. Undo / Redo System

Create a real editor history system.

Undo should support operations such as:

Adding clips

Removing clips

Moving clips

Trimming clips

Changing position

Changing size

Changing rotation

Changing scale

Changing opacity

Redo should restore undone operations.

Use a centralized state/history architecture rather than manually implementing undo separately for every button.

16. Project State

Create a structured project model.

For example:

interface Project {
  name: string;
  duration: number;
  tracks: Track[];
}

interface Track {
  id: string;
  type: "video" | "audio";
  clips: Clip[];
}

interface Clip {
  id: string;
  type: "video" | "image" | "audio";
  source: string;
  timelineStart: number;
  duration: number;
  sourceStart: number;
  sourceEnd: number;

  transform: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    scale: number;
    opacity: number;
  };
}


You may improve this architecture if necessary.

The important thing is to keep the editor state centralized and extensible.

17. Save Project

For this phase, save projects locally.

Use browser storage such as IndexedDB where appropriate.

Save:

Project name

Timeline

Tracks

Clips

Clip positions

Clip durations

Transform properties

Do not permanently copy large video files into localStorage.

Design media storage separately so the application can later support a proper project/media management system.

18. Important UI Behavior

The interface should feel like professional editing software.

Avoid:

Huge buttons

Excessive rounded cards

Mobile-app style UI

Fake statistics

Fake AI features

Random dashboard screens

Prioritize:

Timeline

Preview

Media browser

Properties panel

Professional controls

The user should immediately understand:

Media → Timeline → Select Clip → Properties → Preview

19. Empty State

When the application opens with no project:

Show a simple professional empty state:

Create a new project

Import your media to get started.

[ Import Media ]


After importing media, the empty state should disappear.

20. Architecture Requirements

Keep the code modular.

Separate components for:

Editor

Timeline

TimelineTrack

TimelineClip

VideoPreview

PropertiesPanel

MediaPanel

Toolbar

Playhead

TransformControls

ProjectState

History/UndoRedo

MediaManager

Do not put the entire application inside one giant React component.

Avoid unnecessary dependencies.

Use TypeScript types throughout the project.

21. Performance

The editor must remain usable with multiple clips.

Avoid unnecessary React re-renders during:

Playhead movement

Video playback

Timeline dragging

Property editing

Use efficient state updates.

The architecture should be ready for future GPU/WebGL/WebCodecs/FFmpeg integration.

22. Very Important

Do NOT implement Phase 3 yet.

Do NOT add:

Keyframes

Effects

Transitions

Text editing

Caption generation

Advanced audio effects

Filters

AI features

Export rendering engine

Those will be added later.

Build an extremely solid Phase 1 + Phase 2 foundation first.

Before finishing, test the complete flow:

Open editor

Import video

Add video to timeline

Play video

Move playhead

Select clip

Move clip

Trim clip

Change X/Y

Change width/height

Rotate

Scale

Change opacity

Undo changes

Redo changes

Save project

Reload project

Verify the project state remains correct

Do not replace working existing functionality unnecessarily.

If the project already contains useful components, preserve them and extend the architecture instead of rebuilding everything from scratch.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0dbe0f76-0a71-4b7b-ad18-576d8348c7f0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
