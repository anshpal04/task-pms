step 1. make a login page or signup
	jwt auth and refresh tokes
	roles: user or admin
	middleware rbac


step 2. Project/Board Management

	- Admin creates project board
	- Invite members to board
	- Members can view assigned boards
step 3 task management
	create and assign task
	time due date and priority
	status of the task to do in progress done

step 4. Drag & Drop Kanban Board

- React + dnd-kit
- Drag task between columns
- Update MongoDB
- Emit Socket.io event

step 5. Real-Time Collaboration

- User A moves task
- Backend receives update
- Socket.io broadcasts
- User B sees instant change