import React, { useRef, useEffect, useState, useCallback } from 'react';

export interface RemoteVideoProps {
  stream: MediaStream | null;
  isSelf?: boolean;
  muted?: boolean;
  className?: string;
  onVideoPlaying?: (isPlaying: boolean) => void;
}

/**
 * RemoteVideo Component
 * Solves the WebRTC "Black Screen / Black Video" bug by:
 * 1. Binding MediaStream via videoRef.current.srcObject in useEffect / ref callback
 * 2. Enforcing playsInline, autoPlay, and muted (for safe browser autoplay policies)
 * 3. Listening to videoTrack 'unmute' and 'mute' events to re-trigger playback immediately when frames arrive
 * 4. Executing video.play() on 'loadedmetadata' and catching promise rejections
 */
export const RemoteVideo: React.FC<RemoteVideoProps> = ({
  stream,
  isSelf = false,
  muted = true,
  className = '',
  onVideoPlaying
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const videoTrack = stream ? stream.getVideoTracks()[0] : null;

  const playVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.play()
      .then(() => {
        setIsPlaying(true);
        if (onVideoPlaying) onVideoPlaying(true);
      })
      .catch((err) => {
        console.debug('[RemoteVideo] Autoplay blocked, enforcing muted play:', err);
        video.muted = true;
        video.play()
          .then(() => {
            setIsPlaying(true);
            if (onVideoPlaying) onVideoPlaying(true);
          })
          .catch((e) => console.warn('[RemoteVideo] Play failure:', e));
      });
  }, [onVideoPlaying]);

  // Bind MediaStream to HTMLVideoElement directly
  const attachStream = useCallback((videoElement: HTMLVideoElement | null) => {
    if (!videoElement) return;

    if (stream && videoTrack && videoTrack.readyState === 'live') {
      if (videoElement.srcObject !== stream) {
        videoElement.srcObject = stream;
      }
      playVideo();
    } else {
      videoElement.srcObject = null;
      setIsPlaying(false);
      if (onVideoPlaying) onVideoPlaying(false);
    }
  }, [stream, videoTrack, playVideo, onVideoPlaying]);

  // Ref callback to bind immediately upon DOM insertion
  const setRefCallback = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    attachStream(node);
  }, [attachStream]);

  // Update when stream or track changes
  useEffect(() => {
    attachStream(videoRef.current);
  }, [attachStream]);

  // Track unmute / mute listener (crucial for when the first video frame arrives over WebRTC)
  useEffect(() => {
    if (!videoTrack) return;

    const handleUnmute = () => {
      console.log('[RemoteVideo] Track unmuted, binding stream to video:', videoTrack.id);
      attachStream(videoRef.current);
    };

    const handleMute = () => {
      console.log('[RemoteVideo] Track muted:', videoTrack.id);
      setIsPlaying(false);
      if (onVideoPlaying) onVideoPlaying(false);
    };

    videoTrack.addEventListener('unmute', handleUnmute);
    videoTrack.addEventListener('mute', handleMute);

    return () => {
      videoTrack.removeEventListener('unmute', handleUnmute);
      videoTrack.removeEventListener('mute', handleMute);
    };
  }, [videoTrack, attachStream, onVideoPlaying]);

  return (
    <video
      ref={setRefCallback}
      autoPlay
      playsInline
      muted={muted}
      onLoadedMetadata={() => playVideo()}
      onPlay={() => {
        setIsPlaying(true);
        if (onVideoPlaying) onVideoPlaying(true);
      }}
      className={`w-full h-full object-cover transition-opacity duration-300 ${
        isPlaying ? 'opacity-100' : 'opacity-0'
      } ${isSelf ? 'scale-x-[-1]' : ''} ${className}`}
    />
  );
};

export default RemoteVideo;
