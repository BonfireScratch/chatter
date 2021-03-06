import React, { useState, useEffect, useRef } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { useAuth } from '../contexts/authContext';
import { useChat } from '../contexts/chatContext';
import useDarkMode from '../hooks/useDarkMode';
import { encrypt } from '../crypto';
import { Sidebar, RoomCreation, Messages, MessageInput, SkeletonMessages } from '.';

import { FaMoon, FaSun } from 'react-icons/fa';
import UploadImages from './uploadImages';

const ThemeIcon = () => {
  const [darkTheme, setDarkTheme] = useDarkMode();
  const handleMode = () => setDarkTheme(!darkTheme);

  return (
    <span onClick={handleMode}>
      {darkTheme ? (
        <FaSun size='24' className="text-gray-500 mr-3 ml-4 transition duration-300 ease-in-out hover:text-pink-400 cursor-pointer" />
      ) : (
        <FaMoon size='24' className="text-gray-500 mr-3 ml-4 transition duration-300 ease-in-out hover:text-pink-400 cursor-pointer" />
      )}
    </span>
  );
};

const Dashboard = () => {
  let { roomID = '', currentMessageId = '' }: { roomID: string, currentMessageId: string } = useParams();
  const { currentUser } = useAuth();
  const { ENDPOINT, message, setMessage, setMessages, images, showModal } = useChat();
  const [loading, setLoading] = useState<boolean>(false);
  const [roomExists, setRoomExists] = useState<boolean>(true);
  const socket = useRef<Socket | null>(null);

  let room = useRef<any>();
  let user = useRef<any>();

  const history = useHistory();

  let encryptionKey: string = '';

  useEffect(() => {
    const getRoomData = async (key: string) => {
      encryptionKey = key;

      const roomRes = await axios.get(`${ENDPOINT}/room/${roomID}/info`);

      if (roomRes.status === 204) {
        setRoomExists(false);
        setLoading(false);
        return;
      }

      room.current = roomRes.data;

      const messageRes = await axios.get(`${ENDPOINT}/room/${roomID}/messages`);

      setMessages(messageRes.data);
      setLoading(false);
    }

    const postUser = async () => {
      const res = await axios.post(`${ENDPOINT}/users/`, {
        id: currentUser?.uid,
        username: currentUser?.email,
        nickname: currentUser?.email?.replace(/@[^@]+$/, ''),
        avatarLink: currentUser?.photoURL
      });

      user.current = res.data.user;

      if (!roomID) return;

      socket.current?.emit('join', { user: user.current, roomID }, getRoomData);
    }
    
    socket.current = io(ENDPOINT, { transports: ['websocket'], secure: true, upgrade: false });

    socket.current?.on('message', messageData => {
      setMessages((oldMessages: Array<any>) => [...oldMessages, messageData]);
    });

    socket.current?.on('messageDeletion', messageID => {
      setMessages((oldMessages: Array<any>) => oldMessages.filter((msg: any) => msg._id !== messageID));
    });

    postUser();

    if (!roomID) return;

    setLoading(true);
    setRoomExists(true);

    return () => {
      socket.current?.off('message');
      socket.current?.disconnect();
    };
  }, [roomID]);

  const sendMessage = async (event: React.KeyboardEvent<HTMLInputElement> | null) => {
    event?.preventDefault();

    if (message && !loading) {
      const messageData = {
        type: 'text',
        room: roomID,
        user: user.current,
        message: encrypt(message, encryptionKey),
        date: new Date().getTime(),
      };

      await socket.current?.emit('sendMessage', { roomID, messageData });
      setMessage('');

      history.push(`/app/${roomID}`);
    }
  };

  const deleteMessage = async (messageID: string) => {
    await socket.current?.emit('deleteMessage', { messageID, userID: currentUser?.uid, roomID });
  }

  const sendImage = async (base64: any) => {
    const messageData = {
      type: 'image',
      room: roomID,
      user: user.current,
      message: base64,
      date: new Date().getTime(),
    };

    socket.current?.emit('sendMessage', { roomID, messageData });
  };

  const sendAttachment = async (base64: any) => {
    const messageData = {
      type: 'attachment',
      room: roomID,
      user: user.current,
      message: base64,
      date: new Date().getTime(),
    };

    socket.current?.emit('sendMessage', { roomID, messageData });
  };

  const emitRoomCreation = async (roomName: string) => {
    await socket.current?.emit('createRoom', { roomName }, createRoomCallback);
  }

  const createRoomCallback = (roomData: any) => {
    history.push(`/app/${roomData._id}`);
  }

  return (
    <>
      {showModal ? <RoomCreation nickname={user.current.nickname} emitRoomCreation={emitRoomCreation} /> : null}
      {images.length > 0 ? <UploadImages sendImage={sendImage} /> : null}
      <div className="h-screen w-full overflow-hidden flex">
        <Sidebar user={currentUser} currentRoom={roomID} loading={loading} />
        <div className="w-full h-full overflow-auto bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 transition duration-300">
          <div className="fixed inset-x-0 top-0 flex items-center justify-evenly ml-16 py-3 bg-gray-100 dark:bg-gray-800 bg-opacity-90 shadow-lg">
            <span className="text-gray-800 dark:text-gray-200 text-lg font-semibold pl-6">{room.current?.name}</span>
            <ThemeIcon />
          </div>
          {!roomID
            ? <div className="w-full h-full flex items-center justify-center">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold text-center">Welcome</h1>
                  <h2 className="text-xl sm:text-2xl font-normal text-center">Join a room, or create your own</h2>
                </div>
              </div>
            : null
          }
          {!roomExists
            ? <div className="w-full h-full flex items-center justify-center">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold text-center">This room does not exist</h1>
                  <h2 className="text-xl sm:text-2xl font-normal text-center">Seems like you clicked a wrong link</h2>
                </div>
              </div>
            : null
          }
          {roomID && roomExists ?
            (loading ?
              <SkeletonMessages /> :
              <Messages user={user.current} messageId={currentMessageId} encryptionKey={encryptionKey} deleteMessage={deleteMessage} /> )
            : null
          }
          {roomID && roomExists ? <MessageInput sendMessage={sendMessage} sendAttachment={sendAttachment} /> : null}
        </div>
      </div>
    </>
  );
}

export default Dashboard;
