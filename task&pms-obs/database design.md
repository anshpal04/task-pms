User
 ├─ _id
 ├─ name
 ├─ email
 └─ role

Project
 ├─ _id
 ├─ title
 ├─ admin
 └─ members[]

Task
 ├─ _id
 ├─ title
 ├─ description
 ├─ projectId
 ├─ assignedTo
 ├─ status
 ├─ priority
 └─ dueDate