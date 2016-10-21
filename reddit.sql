-- This creates the users table. The username field is constrained to unique
-- values only, by using a UNIQUE KEY on that column
CREATE TABLE `users` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL,
  `password` VARCHAR(60) NOT NULL, 
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
);

-- This creates the posts table. The userId column references the id column of
-- users. If a user is deleted, the corresponding posts' userIds will be set NULL.
CREATE TABLE `posts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(300) DEFAULT NULL,
  `url` varchar(2000) DEFAULT NULL,
  `userId` int(11) DEFAULT NULL,
  `subredditId` int(11) -- this was added!
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `userId` (`userId`), 
  CONSTRAINT `posts_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL
);

-- Access getAllPosts 

SELECT *
        FROM posts
        JOIN users ON (users.id = posts.userId)
        JOIN subreddit ON (subreddit.id = posts.subredditId);
        

-- Get all post for user by User ID

SELECT *
        FROM posts
        JOIN users
        ON (users.id = posts.userId) where userId=?:

-- Get Single post with post ID
SELECT id,title,url,userId, createdAt, updatedAt 
        FROM posts 
        WHERE posts.id = ?


-- Get subreddit 
CREATE TABLE `subreddit` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(30), -- ALTER TABLE subreddit Alter COLUMN name VARCHAR(30) not null
  `description` varchar(200),
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
);


-- Add subredditId to posts 


-- alter post table to add foreign key to subreddit

alter Table posts add subredditId int(11)

ALTER TABLE `posts` ADD 
      FOREIGN KEY (`subredditId` ) 
      REFERENCES `subreddit` (`id` ) ON DELETE SET NULL;
        
-- Get all subreddits

SELECT * 
  FROM subreddit 
  ORDER BY createdAt 
  DESC
  

-- making alias for getAllPosts'


SELECT  p.id as postId, 
        p.title, p.url, 
        p.createdAt as postCreatedAt, 
        p.updatedAt as postUpdatedAt, 
        u.id as usernameId, 
        u.username, 
        u.createdAt as userCreatedAt, 
        u.updatedAt as userUpdatedAt, 
        s.id as subredditId, 
        s.name as subredditName, 
        s.description as subredditDescription, 
        s.createdAt as subredditCreatedAt, 
        s.updatedAt as subredditUpdatedAt
          FROM posts as p
          JOIN users as u ON u.id = p.userId
          JOIN subreddit as s ON s.id = p.subredditId
          GROUP BY postId
          ORDER BY postCreatedAt DESC;
